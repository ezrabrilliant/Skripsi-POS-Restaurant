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
        Schema::create('settlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('date')->unique();
            $table->foreignUuid('cashier_id')->constrained('users')->onDelete('restrict');
            $table->decimal('system_cash', 12, 2)->default(0);
            $table->decimal('system_edc', 12, 2)->default(0);
            $table->decimal('system_transfer', 12, 2)->default(0);
            $table->decimal('system_total', 12, 2)->default(0);
            $table->decimal('actual_cash', 12, 2)->default(0);
            $table->decimal('actual_edc', 12, 2)->default(0);
            $table->decimal('actual_transfer', 12, 2)->default(0);
            $table->decimal('actual_total', 12, 2)->default(0);
            $table->decimal('variance_cash', 12, 2)->default(0);
            $table->decimal('variance_edc', 12, 2)->default(0);
            $table->decimal('variance_total', 12, 2)->default(0);
            $table->text('variance_reason')->nullable();
            $table->enum('status', ['pending', 'submitted', 'reviewed'])->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settlements');
    }
};
