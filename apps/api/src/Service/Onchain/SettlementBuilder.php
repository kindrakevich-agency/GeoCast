<?php

declare(strict_types=1);

namespace App\Service\Onchain;

use Doctrine\DBAL\Connection;

/**
 * End-to-end off-chain settler. Reads the Revealed events for a round,
 * combines them with the admin-supplied answer, runs MerkleBuilder to
 * get root + per-leaf proofs, and persists the proofs to MariaDB so
 * the frontend's claim UI can hand them straight to GeoCastPool.claim().
 *
 * The Merkle root returned here is what the admin then submits via
 * GeoCastPool.resolve(roundId, answerLat, answerLng, root).
 *
 * Pool size derivation: BET (1 USDC) × count(Committed for this round).
 * If a player committed but never revealed they forfeit their bet to the
 * pool — those addresses don't appear as leaves, so their dust falls
 * into Σpayouts ≤ pool − rake.
 */
final class SettlementBuilder
{
    /** USDC micros per pin — must match GeoCastPool.BET. */
    public const BET_MICROS = 1_000_000;

    public function __construct(
        private readonly Connection $db,
        private readonly MerkleBuilder $merkle,
    ) {
    }

    /**
     * @return array{merkleRoot: string, rakeMicros: int, totalPayoutMicros: int, leafCount: int, dustMicros: int}
     */
    public function settle(int $roundId, float $answerLat, float $answerLng): array
    {
        $reveals = $this->loadReveals($roundId);
        $commits = $this->countCommits($roundId);
        if ($commits === 0) {
            throw new \RuntimeException(sprintf('Round %d has no on-chain commits yet.', $roundId));
        }
        $poolMicros = $commits * self::BET_MICROS;

        $result = $this->merkle->build($answerLat, $answerLng, $reveals, $poolMicros);

        $this->persistProofs($roundId, $result['merkleRoot'], $result['entries']);

        return [
            'merkleRoot' => $result['merkleRoot'],
            'rakeMicros' => $result['rakeMicros'],
            'totalPayoutMicros' => $result['totalPayoutMicros'],
            'leafCount' => \count($result['entries']),
            'dustMicros' => $result['dustMicros'],
        ];
    }

    /**
     * @return list<array{address: string, lat: float, lng: float}>
     */
    private function loadReveals(int $roundId): array
    {
        $rows = $this->db->fetchAllAssociative(
            "SELECT payload_json FROM onchain_events
             WHERE event_name = 'Revealed' AND round_id = ?
             ORDER BY block_number ASC, log_index ASC",
            [$roundId],
        );

        $out = [];
        foreach ($rows as $row) {
            /** @var array{event: string, player: string, lat: int, lng: int} $p */
            $p = json_decode((string) $row['payload_json'], true);
            // Coords come from the contract as int32 fixed-point (degrees × 1e6).
            $out[] = [
                'address' => $p['player'],
                'lat' => $p['lat'] / 1_000_000.0,
                'lng' => $p['lng'] / 1_000_000.0,
            ];
        }
        return $out;
    }

    private function countCommits(int $roundId): int
    {
        return (int) $this->db->fetchOne(
            "SELECT COUNT(*) FROM onchain_events
             WHERE event_name = 'Committed' AND round_id = ?",
            [$roundId],
        );
    }

    /**
     * @param list<array{address: string, distanceKm: float, rawScore: float, amountMicros: int, proof: list<string>}> $entries
     */
    private function persistProofs(int $roundId, string $merkleRoot, array $entries): void
    {
        // INSERT … ON DUPLICATE KEY UPDATE — re-running the settler with a
        // different answer overwrites the previous proofs (admin can re-run
        // before submitting the on-chain resolve() tx).
        foreach ($entries as $i => $e) {
            $this->db->executeStatement(
                'INSERT INTO settlement_proofs
                   (round_id, player_address, amount_micros, proof_json,
                    merkle_root, distance_km, rank_pos, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE
                   amount_micros = VALUES(amount_micros),
                   proof_json = VALUES(proof_json),
                   merkle_root = VALUES(merkle_root),
                   distance_km = VALUES(distance_km),
                   rank_pos = VALUES(rank_pos),
                   created_at = NOW()',
                [
                    $roundId,
                    strtolower($e['address']),
                    $e['amountMicros'],
                    json_encode($e['proof'], \JSON_UNESCAPED_SLASHES),
                    $merkleRoot,
                    $e['distanceKm'],
                    $i + 1, // rank — entries are already sorted by build()
                ],
            );
        }
    }

    /**
     * Fetch the proof for one player on one round. Returns null if the
     * round hasn't been settled yet or the player wasn't a participant.
     *
     * @return array{amountMicros: int, proof: list<string>, merkleRoot: string, distanceKm: float|null, rank: int|null}|null
     */
    public function getProof(int $roundId, string $playerAddress): ?array
    {
        $row = $this->db->fetchAssociative(
            'SELECT amount_micros, proof_json, merkle_root, distance_km, rank_pos
             FROM settlement_proofs
             WHERE round_id = ? AND player_address = ?',
            [$roundId, strtolower($playerAddress)],
        );
        if ($row === false) {
            return null;
        }
        return [
            'amountMicros' => (int) $row['amount_micros'],
            'proof' => json_decode((string) $row['proof_json'], true) ?: [],
            'merkleRoot' => (string) $row['merkle_root'],
            'distanceKm' => $row['distance_km'] !== null ? (float) $row['distance_km'] : null,
            'rank' => $row['rank_pos'] !== null ? (int) $row['rank_pos'] : null,
        ];
    }
}
