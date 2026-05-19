<?php

declare(strict_types=1);

namespace App\Security;

use App\Entity\User;
use App\Repository\UserRepository;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

/**
 * Loads a User from the DB by wallet address — the value Lexik puts into
 * the JWT's `username` claim (because User::getUserIdentifier() returns
 * the wallet address).
 *
 * @implements UserProviderInterface<User>
 */
final class WalletUserProvider implements UserProviderInterface
{
    public function __construct(private readonly UserRepository $users)
    {
    }

    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        $user = $this->users->findByWallet($identifier);
        if ($user === null) {
            throw new UserNotFoundException(sprintf('No user with wallet "%s".', $identifier));
        }

        return $user;
    }

    public function refreshUser(UserInterface $user): UserInterface
    {
        if (!$user instanceof User) {
            throw new \LogicException(sprintf('Cannot refresh user of type %s.', $user::class));
        }

        return $this->loadUserByIdentifier($user->getUserIdentifier());
    }

    public function supportsClass(string $class): bool
    {
        return is_a($class, User::class, true);
    }
}
