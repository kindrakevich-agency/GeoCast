<?php

declare(strict_types=1);

namespace App\Service\User;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Find-or-create a User by wallet address. On first sign-in we hydrate
 * the row with starting credits and check the ADMIN_WALLETS allowlist
 * (comma-separated lowercase addresses in .env.local) to flip is_admin.
 */
final class UserProvisioner
{
    /** @var list<string> Lowercase admin wallet addresses. */
    private array $adminWallets;

    public function __construct(
        private readonly UserRepository $users,
        private readonly EntityManagerInterface $em,
        string $adminWalletsCsv = '',
    ) {
        $this->adminWallets = array_values(array_filter(array_map(
            static fn (string $w): string => strtolower(trim($w)),
            explode(',', $adminWalletsCsv),
        )));
    }

    public function findOrCreate(string $walletAddress): User
    {
        $existing = $this->users->findByWallet($walletAddress);
        if ($existing !== null) {
            return $existing;
        }

        $user = new User($walletAddress);
        if (\in_array(strtolower($walletAddress), $this->adminWallets, true)) {
            $user->setIsAdmin(true);
        }

        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }
}
