<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('table_number', 20);
            $table->enum('status', ['open', 'paid', 'void'])->default('open');
            $table->string('payment_method', 50)->nullable(); // cash, edc_bca, edc_mandiri, qris, transfer
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->decimal('change_amount', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->uuid('cashier_id')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            // Foreign key
            $table->foreign('cashier_id')
                ->references('id')
                ->on('users')
                ->onDelete('set null');

            // Indexes
            $table->index('status');
            $table->index(['table_number', 'status']);
            $table->index('created_at');
            $table->index(['paid_at', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
