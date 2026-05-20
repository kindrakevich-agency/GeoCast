<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\RoundStatus;
use App\Repository\RoundRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UlidType;
use Symfony\Component\Uid\Ulid;

#[ORM\Entity(repositoryClass: RoundRepository::class)]
#[ORM\Table(name: 'rounds')]
#[ORM\Index(name: 'idx_rounds_status_closes', columns: ['status', 'closes_at'])]
class Round
{
    #[ORM\Id]
    #[ORM\Column(type: UlidType::NAME, unique: true)]
    private Ulid $id;

    /**
     * Sequential round number for display (#482 style). Set by the round-create
     * service from `MAX(number) + 1` — uniqueness enforced at the DB level.
     */
    #[ORM\Column(type: 'integer', unique: true)]
    private int $number;

    #[ORM\Column(length: 280)]
    private string $question;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $opensAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $closesAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $resolvesAt = null;

    #[ORM\Column(type: 'string', length: 16, enumType: RoundStatus::class)]
    private RoundStatus $status = RoundStatus::Scheduled;

    #[ORM\Column(type: 'float', nullable: true)]
    private ?float $answerLat = null;

    #[ORM\Column(type: 'float', nullable: true)]
    private ?float $answerLng = null;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $totalParticipants = 0;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $poolCredits = 0;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $resolvedAt = null;

    /**
     * Optional auto-resolver wiring. When set, app:rounds:auto-resolve runs
     * the matching resolver at resolvesAt and posts the answer automatically.
     * NULL = admin-resolved (the original flow).
     */
    #[ORM\Column(type: 'string', length: 64, nullable: true)]
    private ?string $autoResolverCode = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $autoResolverParams = null;

    /**
     * Multi-winner answer support. NULL = legacy single-winner round
     * (use answerLat/answerLng). Otherwise [[lat,lng,name], …]; the first
     * entry mirrors answerLat/answerLng for back-compat with single-answer
     * code paths.
     *
     * @var list<array{lat: float, lng: float, name: string}>|null
     */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $answerPoints = null;

    public function __construct(int $number, string $question, \DateTimeImmutable $opensAt, \DateTimeImmutable $closesAt)
    {
        $this->id = new Ulid();
        $this->number = $number;
        $this->question = $question;
        $this->opensAt = $opensAt;
        $this->closesAt = $closesAt;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): Ulid { return $this->id; }
    public function getNumber(): int { return $this->number; }
    public function getQuestion(): string { return $this->question; }
    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $description): self { $this->description = $description; return $this; }
    public function getOpensAt(): \DateTimeImmutable { return $this->opensAt; }
    public function getClosesAt(): \DateTimeImmutable { return $this->closesAt; }
    public function getResolvesAt(): ?\DateTimeImmutable { return $this->resolvesAt; }
    public function setResolvesAt(?\DateTimeImmutable $resolvesAt): self { $this->resolvesAt = $resolvesAt; return $this; }
    public function getStatus(): RoundStatus { return $this->status; }
    public function setStatus(RoundStatus $status): self { $this->status = $status; return $this; }
    public function getAnswerLat(): ?float { return $this->answerLat; }
    public function getAnswerLng(): ?float { return $this->answerLng; }
    public function setAnswer(float $lat, float $lng): self
    {
        $this->answerLat = $lat;
        $this->answerLng = $lng;
        return $this;
    }
    public function getTotalParticipants(): int { return $this->totalParticipants; }
    public function setTotalParticipants(int $count): self { $this->totalParticipants = $count; return $this; }
    public function getPoolCredits(): int { return $this->poolCredits; }
    public function setPoolCredits(int $credits): self { $this->poolCredits = $credits; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getResolvedAt(): ?\DateTimeImmutable { return $this->resolvedAt; }
    public function setResolvedAt(?\DateTimeImmutable $resolvedAt): self { $this->resolvedAt = $resolvedAt; return $this; }

    public function getAutoResolverCode(): ?string { return $this->autoResolverCode; }
    public function setAutoResolverCode(?string $code): self { $this->autoResolverCode = $code; return $this; }

    /** @return array<string, mixed>|null */
    public function getAutoResolverParams(): ?array { return $this->autoResolverParams; }
    /** @param array<string, mixed>|null $params */
    public function setAutoResolverParams(?array $params): self { $this->autoResolverParams = $params; return $this; }

    /** @return list<array{lat: float, lng: float, name: string}>|null */
    public function getAnswerPoints(): ?array { return $this->answerPoints; }
    /** @param list<array{lat: float, lng: float, name: string}>|null $points */
    public function setAnswerPoints(?array $points): self { $this->answerPoints = $points; return $this; }
}
