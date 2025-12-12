<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transaction extends Model
{
    use HasFactory, HasUuids;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'table_number',
        'status',
        'payment_method',
        'subtotal',
        'discount_amount',
        'total_amount',
        'amount_paid',
        'change_amount',
        'notes',
        'cashier_id',
        'paid_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'subtotal' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'change_amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    /**
     * Get the cashier for this transaction
     */
    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    /**
     * Get items in this transaction
     */
    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    /**
     * Check if transaction is open
     */
    public function isOpen(): bool
    {
        return $this->status === 'open';
    }

    /**
     * Check if transaction is paid
     */
    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }

    /**
     * Check if transaction is void
     */
    public function isVoid(): bool
    {
        return $this->status === 'void';
    }

    /**
     * Calculate totals from items
     */
    public function calculateTotals(): void
    {
        $subtotal = $this->items()->sum('subtotal');
        $this->subtotal = $subtotal;
        $this->total_amount = $subtotal - $this->discount_amount;
        $this->save();
    }

    /**
     * Alias for calculateTotals
     */
    public function recalculateTotals(): void
    {
        $this->calculateTotals();
    }

    /**
     * Process payment
     */
    public function processPayment(string $paymentMethod, float $amountPaid): void
    {
        $this->payment_method = $paymentMethod;
        $this->amount_paid = $amountPaid;
        $this->change_amount = max(0, $amountPaid - $this->total_amount);
        $this->status = 'paid';
        $this->paid_at = now();
        $this->save();
    }

    /**
     * Void transaction
     */
    public function voidTransaction(): void
    {
        $this->status = 'void';
        $this->save();

        // Restore stock for voided items
        foreach ($this->items as $item) {
            $dailyStock = DailyMenuStock::where('menu_id', $item->menu_id)
                ->where('date', $this->created_at->toDateString())
                ->first();

            if ($dailyStock) {
                $dailyStock->increaseStock($item->quantity);
            }
        }
    }

    /**
     * Scope for open transactions
     */
    public function scopeOpen($query)
    {
        return $query->where('status', 'open');
    }

    /**
     * Scope for paid transactions
     */
    public function scopePaid($query)
    {
        return $query->where('status', 'paid');
    }

    /**
     * Scope for specific table
     */
    public function scopeForTable($query, string $tableNumber)
    {
        return $query->where('table_number', $tableNumber);
    }

    /**
     * Scope for today
     */
    public function scopeToday($query)
    {
        return $query->whereDate('created_at', now()->toDateString());
    }

    /**
     * Scope for paid today
     */
    public function scopePaidToday($query)
    {
        return $query->paid()->whereDate('paid_at', now()->toDateString());
    }
}
