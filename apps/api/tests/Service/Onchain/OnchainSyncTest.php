<?php

declare(strict_types=1);

namespace App\Tests\Service\Onchain;

use App\Service\Onchain\EthRpcClient;
use App\Service\Onchain\EventDecoder;
use App\Service\Onchain\OnchainSync;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for OnchainSync. Uses a stub RPC + an in-memory DBAL pretender
 * so the orchestration logic is exercised without a real network or DB.
 */
final class OnchainSyncTest extends TestCase
{
    public function testNoOpsWhenContractAddressEmpty(): void
    {
        $rpc = $this->createStub(EthRpcClient::class);
        $rpc->method('blockNumber')->willReturn(100);

        $db = $this->createMock(Connection::class);
        $db->expects($this->never())->method('beginTransaction');

        $sync = new OnchainSync($db, $rpc, new EventDecoder(), 8453, '', 0);
        $this->assertSame(0, $sync->tick());
    }

    public function testNoOpsWhenContractAddressZeroPrefixed(): void
    {
        $rpc = $this->createStub(EthRpcClient::class);
        $db = $this->createMock(Connection::class);
        $db->expects($this->never())->method('beginTransaction');

        $sync = new OnchainSync(
            $db,
            $rpc,
            new EventDecoder(),
            8453,
            '0x0000000000000000000000000000000000000000',
            0,
        );
        $this->assertSame(0, $sync->tick());
    }

    public function testNoOpsWhenAlreadyAtHead(): void
    {
        $rpc = $this->createStub(EthRpcClient::class);
        // Chain head reports block 100; minus 2 confirmations = 98.
        $rpc->method('blockNumber')->willReturn(100);

        $db = $this->createMock(Connection::class);
        $db->method('fetchAssociative')->willReturn(['last_block' => 98]);
        $db->expects($this->never())->method('beginTransaction');

        $sync = new OnchainSync(
            $db,
            $rpc,
            new EventDecoder(),
            8453,
            '0x1111111111111111111111111111111111111111',
            0,
        );
        $this->assertSame(0, $sync->tick());
    }

    public function testIngestsCommittedEventInWindow(): void
    {
        $decoder = new EventDecoder();
        $rpc = $this->createStub(EthRpcClient::class);
        $rpc->method('blockNumber')->willReturn(102);     // head = 100 after 2 confs

        $rpc->method('getLogs')->willReturn([
            [
                'topics' => [
                    $decoder->topics[EventDecoder::SIG_COMMITTED],
                    '0x000000000000000000000000000000000000000000000000000000000000000a', // round 10
                    '0x000000000000000000000000abcdef0000000000000000000000000000000001',
                ],
                'data' => '0x' . str_repeat('11', 32),
                'transactionHash' => '0xbeef',
                'blockNumber' => '0x42',
                'logIndex' => '0x0',
            ],
        ]);

        $db = $this->createMock(Connection::class);
        // First call: load cursor (returns "no row").
        $db->method('fetchAssociative')->willReturn(false);
        // Expect one event INSERT IGNORE + one cursor UPSERT inside a txn.
        $db->expects($this->once())->method('beginTransaction');
        $db->expects($this->exactly(2))->method('executeStatement');
        $db->expects($this->once())->method('commit');
        $db->expects($this->never())->method('rollBack');

        $sync = new OnchainSync(
            $db,
            $rpc,
            $decoder,
            8453,
            '0x1111111111111111111111111111111111111111',
            0,
        );
        $this->assertSame(1, $sync->tick());
    }

    public function testRollsBackOnInsertFailure(): void
    {
        $decoder = new EventDecoder();
        $rpc = $this->createStub(EthRpcClient::class);
        $rpc->method('blockNumber')->willReturn(102);
        $rpc->method('getLogs')->willReturn([
            [
                'topics' => [
                    $decoder->topics[EventDecoder::SIG_COMMITTED],
                    '0x000000000000000000000000000000000000000000000000000000000000000a',
                    '0x000000000000000000000000abcdef0000000000000000000000000000000001',
                ],
                'data' => '0x' . str_repeat('11', 32),
                'transactionHash' => '0xbeef',
                'blockNumber' => '0x42',
                'logIndex' => '0x0',
            ],
        ]);

        $db = $this->createMock(Connection::class);
        $db->method('fetchAssociative')->willReturn(false);
        $db->expects($this->once())->method('beginTransaction');
        $db->method('executeStatement')->willThrowException(new \RuntimeException('db down'));
        $db->expects($this->never())->method('commit');
        $db->expects($this->once())->method('rollBack');

        $sync = new OnchainSync(
            $db,
            $rpc,
            $decoder,
            8453,
            '0x1111111111111111111111111111111111111111',
            0,
        );
        $this->expectException(\RuntimeException::class);
        $sync->tick();
    }
}
