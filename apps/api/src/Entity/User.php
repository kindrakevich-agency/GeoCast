<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UlidType;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Uid\Ulid;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'users')]
#[ORM\Index(name: 'idx_users_wallet', columns: ['wallet_address'])]
class User implements UserInterface
{
    #[ORM\Id]
    #[ORM\Column(type: UlidType::NAME, unique: true)]
    private Ulid $id;

    #[ORM\Column(length: 42, unique: true)]
    private string $walletAddress;

    #[ORM\Column(type: 'integer', options: ['default' => 100])]
    private int $creditsBalance = 100;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $gamesPlayed = 0;

    #[ORM\Column(type: 'float', options: ['default' => 0.0])]
    private float $totalScore = 0.0;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $isAdmin = false;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct(string $walletAddress)
    {
        $this->id = new Ulid();
        $this->walletAddress = strtolower($walletAddress);
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): Ulid
    {
        return $this->id;
    }

    public function getWalletAddress(): string
    {
        return $this->walletAddress;
    }

    public function getCreditsBalance(): int
    {
        return $this->creditsBalance;
    }

    public function setCreditsBalance(int $balance): self
    {
        $this->creditsBalance = $balance;

        return $this;
    }

    public function getGamesPlayed(): int
    {
        return $this->gamesPlayed;
    }

    public function setGamesPlayed(int $count): self
    {
        $this->gamesPlayed = $count;

        return $this;
    }

    public function getTotalScore(): float
    {
        return $this->totalScore;
    }

    public function setTotalScore(float $score): self
    {
        $this->totalScore = $score;

        return $this;
    }

    public function isAdmin(): bool
    {
        return $this->isAdmin;
    }

    public function setIsAdmin(bool $isAdmin): self
    {
        $this->isAdmin = $isAdmin;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    // -- UserInterface --

    public function getRoles(): array
    {
        $roles = ['ROLE_USER'];
        if ($this->isAdmin) {
            $roles[] = 'ROLE_ADMIN';
        }

        return $roles;
    }

    public function eraseCredentials(): void
    {
        // No persistent credentials — SIWE auth is per-request.
    }

    public function getUserIdentifier(): string
    {
        return $this->walletAddress;
    }
}
