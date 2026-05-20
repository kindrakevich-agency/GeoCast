<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\SuggestionStatus;
use App\Repository\RoundSuggestionRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UlidType;
use Symfony\Component\Uid\Ulid;

/**
 * A candidate question proposed by app:questions:suggest, waiting for an
 * admin to publish (accept) or dismiss (reject). Once accepted, the Round
 * it created back-references via `used_for_round_id`.
 */
#[ORM\Entity(repositoryClass: RoundSuggestionRepository::class)]
#[ORM\Table(name: 'round_suggestions')]
#[ORM\Index(name: 'idx_status', columns: ['status', 'created_at'])]
class RoundSuggestion
{
    #[ORM\Id]
    #[ORM\Column(type: UlidType::NAME, unique: true)]
    private Ulid $id;

    #[ORM\Column(type: 'string', length: 64)]
    private string $resolverCode;

    /** @var array<string, mixed> */
    #[ORM\Column(type: 'json')]
    private array $resolverParams;

    #[ORM\Column(type: 'string', length: 280)]
    private string $proposedQuestion;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $proposedOpensAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $proposedClosesAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $proposedResolvesAt;

    /** @var array<string, mixed>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $previewJson = null;

    #[ORM\Column(type: 'string', length: 16, enumType: SuggestionStatus::class)]
    private SuggestionStatus $status = SuggestionStatus::Pending;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: UlidType::NAME, nullable: true)]
    private ?Ulid $usedForRoundId = null;

    /**
     * @param array<string, mixed> $resolverParams
     * @param array<string, mixed>|null $previewJson
     */
    public function __construct(
        string $resolverCode,
        array $resolverParams,
        string $proposedQuestion,
        \DateTimeImmutable $opensAt,
        \DateTimeImmutable $closesAt,
        \DateTimeImmutable $resolvesAt,
        ?array $previewJson = null,
    ) {
        $this->id = new Ulid();
        $this->resolverCode = $resolverCode;
        $this->resolverParams = $resolverParams;
        $this->proposedQuestion = $proposedQuestion;
        $this->proposedOpensAt = $opensAt;
        $this->proposedClosesAt = $closesAt;
        $this->proposedResolvesAt = $resolvesAt;
        $this->previewJson = $previewJson;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): Ulid { return $this->id; }
    public function getResolverCode(): string { return $this->resolverCode; }
    /** @return array<string, mixed> */
    public function getResolverParams(): array { return $this->resolverParams; }
    public function getProposedQuestion(): string { return $this->proposedQuestion; }
    public function getProposedOpensAt(): \DateTimeImmutable { return $this->proposedOpensAt; }
    public function getProposedClosesAt(): \DateTimeImmutable { return $this->proposedClosesAt; }
    public function getProposedResolvesAt(): \DateTimeImmutable { return $this->proposedResolvesAt; }
    /** @return array<string, mixed>|null */
    public function getPreviewJson(): ?array { return $this->previewJson; }
    public function getStatus(): SuggestionStatus { return $this->status; }
    public function setStatus(SuggestionStatus $s): self { $this->status = $s; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUsedForRoundId(): ?Ulid { return $this->usedForRoundId; }
    public function setUsedForRoundId(?Ulid $id): self { $this->usedForRoundId = $id; return $this; }
}
