<?php

declare(strict_types=1);

namespace App\Enum;

enum RoundStatus: string
{
    case Scheduled = 'scheduled';
    case Open      = 'open';
    case Closed    = 'closed';
    case Resolved  = 'resolved';
}
