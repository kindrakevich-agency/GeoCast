<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\PredictionRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UlidType;
use Symfony\Component\Uid\Ulid;

/**
 * One pin per user per round (enforced by composite UNIQUE).
 *
 * Coordinates are stored as separate FLOAT columns (lat/lng) for portability.
 * A SPATIAL POINT column with SRID 4326 is added in the migration for spatial
 * queries (ST_Distance_Sphere etc.), but the application reads lat/lng from
 * the float columns — keeps Doctrine simple, no custom DBAL type needed.
 */
#[ORM\Entity(repositoryClass: PredictionRepository::class)]
#[ORM\Table(name: 'predictions')]
#[ORM\UniqueConstraint(name: 'uniq_predictions_user_round', columns: ['user_id', 'round_id'])]
#[ORM\Index(name: 'idx_predictions_round_distance', columns: ['round_id', 'distance_km'])]
class Prediction
{
    #[ORM\Id]
    #[ORM\Column(type: UlidType::NAME, unique: true)]
    private Ulid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Round::class)]
    #[ORM\JoinColumn(name: 'round_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Round $round;

    #[ORM\Column(type: 'float')]
    private float $lat;

    #[ORM\Column(type: 'float')]
    private float $lng;

    #[ORM\Column(type: 'integer', options: ['default' => 1])]
    private int $creditsStaked = 1;

    #[ORM\Column(type: 'float', nullable: true)]
    private ?float $distanceKm = null;

    #[ORM\Column(name: '`rank`', type: 'integer', nullable: true)]
    private ?int $rank = null;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $payout = 0;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $placedAt;

    public function __construct(User $user, Round $round, float $lat, float $lng)
    {
        $this->id = new Ulid();
        $this->user = $user;
        $this->round = $round;
        $this->lat = $lat;
        $this->lng = $lng;
        $this->placedAt = new \DateTimeImmutable();
    }

    public function getId(): Ulid { return $this->id; }
    public function getUser(): User { return $this->user; }
    public function getRound(): Round { return $this->round; }
    public function getLat(): float { return $this->lat; }
    public function getLng(): float { return $this->lng; }
    public function getCreditsStaked(): int { return $this->creditsStaked; }
    public function setCreditsStaked(int $credits): self { $this->creditsStaked = $credits; return $this; }
    public function getDistanceKm(): ?float { return $this->distanceKm; }
    public function setDistanceKm(?float $km): self { $this->distanceKm = $km; return $this; }
    public function getRank(): ?int { return $this->rank; }
    public function setRank(?int $rank): self { $this->rank = $rank; return $this; }
    public function getPayout(): int { return $this->payout; }
    public function setPayout(int $payout): self { $this->payout = $payout; return $this; }
    public function getPlacedAt(): \DateTimeImmutable { return $this->placedAt; }
}
