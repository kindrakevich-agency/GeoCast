<?php

declare(strict_types=1);

namespace App\Service\Onchain;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Minimal JSON-RPC 2.0 client for an EVM node. No web3 library — just
 * curl-shaped POSTs because we only need three methods (block number +
 * getLogs + getTransactionReceipt).
 *
 * No retries here; the caller is the cron, which will try again next tick.
 * Failures bubble up so the cron's exit code reflects the truth.
 */
// Note: not `final` — PHPUnit can't double final classes, and we mock
// this in OnchainSyncTest. If perf/intent demands sealing, swap to an
// interface + impl pair.
class EthRpcClient
{
    public function __construct(
        private readonly HttpClientInterface $http,
        private readonly string $rpcUrl,
    ) {
    }

    public function blockNumber(): int
    {
        return $this->hexToInt($this->call('eth_blockNumber', []));
    }

    /**
     * eth_getLogs with a fromBlock/toBlock window + topic filter.
     *
     * @param list<string> $topics  topic0 candidates (event sig hashes)
     * @return list<array<string, mixed>> raw log objects
     */
    public function getLogs(string $address, int $fromBlock, int $toBlock, array $topics): array
    {
        $params = [[
            'address' => strtolower($address),
            'fromBlock' => '0x' . dechex($fromBlock),
            'toBlock'   => '0x' . dechex($toBlock),
            'topics'    => [$topics], // OR-filter on topic0
        ]];
        $result = $this->call('eth_getLogs', $params);
        if (!\is_array($result)) {
            throw new \RuntimeException('eth_getLogs returned non-array');
        }
        return $result;
    }

    private function call(string $method, array $params): mixed
    {
        $resp = $this->http->request('POST', $this->rpcUrl, [
            'json' => [
                'jsonrpc' => '2.0',
                'id'      => 1,
                'method'  => $method,
                'params'  => $params,
            ],
            'timeout' => 10,
        ]);
        $body = $resp->toArray(false);
        if (isset($body['error'])) {
            throw new \RuntimeException(sprintf('RPC error %d: %s', $body['error']['code'] ?? -1, $body['error']['message'] ?? '?'));
        }
        return $body['result'] ?? null;
    }

    private function hexToInt(mixed $hex): int
    {
        if (!\is_string($hex) || !str_starts_with($hex, '0x')) {
            throw new \RuntimeException('Expected 0x-prefixed hex');
        }
        return (int) hexdec(substr($hex, 2));
    }
}
