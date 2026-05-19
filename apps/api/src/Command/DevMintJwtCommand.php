<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\User\UserProvisioner;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Dev-only: mint a JWT for a wallet address without going through SIWE.
 *
 *     bin/console app:dev:mint-jwt 0x7f4c2b8e9a3d1f6c0b2e1a4d5c6b7a8e9f0a3b1d
 *
 * Use to smoke-test JWT-protected endpoints locally. In production this
 * command still works (intentionally — admin uses it to bootstrap their
 * own admin token when ADMIN_WALLETS is already populated), but normal
 * sign-in always uses the real /api/auth/verify flow.
 */
#[AsCommand(
    name: 'app:dev:mint-jwt',
    description: 'Mint a JWT for the given wallet (find-or-create user). Dev helper.',
)]
final class DevMintJwtCommand extends Command
{
    public function __construct(
        private readonly UserProvisioner $provisioner,
        private readonly JWTTokenManagerInterface $jwt,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('wallet', InputArgument::REQUIRED, '0x-prefixed 40-hex-char Ethereum address')
            ->addOption('admin', null, InputOption::VALUE_NONE, 'Force is_admin=true on the user');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $wallet = trim((string) $input->getArgument('wallet'));
        if (!preg_match('/^0x[a-fA-F0-9]{40}$/', $wallet)) {
            $output->writeln('<error>Wallet must be 0x-prefixed 40 hex chars.</error>');

            return Command::INVALID;
        }

        $user = $this->provisioner->findOrCreate($wallet);
        if ($input->getOption('admin') && !$user->isAdmin()) {
            $user->setIsAdmin(true);
            $this->em->flush();
        }

        $token = $this->jwt->create($user);
        $output->writeln($token);

        return Command::SUCCESS;
    }
}
