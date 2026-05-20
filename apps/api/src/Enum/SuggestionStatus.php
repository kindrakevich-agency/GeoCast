<?php

declare(strict_types=1);

namespace App\Enum;

enum SuggestionStatus: string
{
    /** Written by app:questions:suggest, waiting for admin to pick. */
    case Pending = 'pending';
    /** Admin accepted — materialized into a Round (used_for_round_id set). */
    case Accepted = 'accepted';
    /** Admin dismissed — won't be shown again. */
    case Rejected = 'rejected';
    /** Auto-expired — proposed window passed without being picked. */
    case Expired = 'expired';
}
