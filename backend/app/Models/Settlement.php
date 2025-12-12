<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Settlement extends Model
{
    use HasFactory, HasUuids;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'date',
        'cashier_id',
        'system_cash',
        'system_edc',
        'system_transfer',
        'system_total',
        'actual_cash',
        'actual_edc',
        'actual_transfer',
        'actual_total',
        'variance_cash',
        'variance_edc',
        'variance_total',
        'variance_reason',
        'status',
        'notes',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'date' => 'date',
        'system_cash' => 'decimal:2',
        'system_edc' => 'decimal:2',
        'system_transfer' => 'decimal:2',
        'system_total' => 'decimal:2',
        'actual_cash' => 'decimal:2',
        'actual_edc' => 'decimal:2',
        'actual_transfer' => 'decimal:2',
        'actual_total' => 'decimal:2',
        'variance_cash' => 'decimal:2',
        'variance_edc' => 'decimal:2',
        'variance_total' => 'decimal:2',
    ];

    /**
     * Get the cashier who created this settlement
     */
    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    /**
     * Calculate variances
     */
    public function calculateVariances(): void
    {
        $this->variance_cash = $this->actual_cash - $this->system_cash;
        $this->variance_edc = $this->actual_edc - $this->system_edc;
        $this->variance_total = $this->actual_total - $this->system_total;
    }

    /**
     * Check if there's any variance
     */
    public function hasVariance(): bool
    {
        return $this->variance_cash != 0 || 
               $this->variance_edc != 0 || 
               $this->variance_total != 0;
    }

    /**
     * Calculate system totals from transactions
     */
    public static function calculateSystemTotals($date): array
    {
        $transactions = Transaction::paid()
            ->whereDate('paid_at', $date)
            ->get();

        $systemCash = $transactions->where('payment_method', 'cash')->sum('total_amount');
        $systemEdc = $transactions->whereIn('payment_method', ['edc_bca', 'edc_mandiri'])->sum('total_amount');
        $systemTransfer = $transactions->whereIn('payment_method', ['transfer', 'qris'])->sum('total_amount');
        $systemTotal = $systemCash + $systemEdc + $systemTransfer;

        return [
            'system_cash' => $systemCash,
            'system_edc' => $systemEdc,
            'system_transfer' => $systemTransfer,
            'system_total' => $systemTotal,
        ];
    }

    /**
     * Boot function
     */
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($settlement) {
            // Calculate actual total
            $settlement->actual_total = $settlement->actual_cash + 
                                        $settlement->actual_edc + 
                                        $settlement->actual_transfer;

            // Calculate variances
            $settlement->calculateVariances();
        });
    }

    /**
     * Scope for pending settlements
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope for submitted settlements
     */
    public function scopeSubmitted($query)
    {
        return $query->where('status', 'submitted');
    }
}
