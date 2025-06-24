import { NextRequest, NextResponse } from "next/server";
import { initializeDataSource } from "../../../../data-source";
import { Deal } from "../../../../lib/entities/deals/Deal";
import { queryDealsCount } from "../../../../lib/persistence/deals";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const transportation_mode = searchParams.get('transportation_mode');
    const sales_rep = searchParams.get('sales_rep');
    const min_value = searchParams.get('min_value');
    const max_value = searchParams.get('max_value');
    const min_date = searchParams.get('min_date');
    const max_date = searchParams.get('max_date');

    // Parse min_value and max_value if present
    const minValue = min_value ? parseFloat(min_value) : null;
    const maxValue = max_value ? parseFloat(max_value) : null;

    const dataSource = await initializeDataSource();
    const dealRepository = dataSource.getRepository(Deal);

    // Get count of closed won deals
    const closedWonCount = await queryDealsCount(dealRepository, {
      stage: 'closed_won',
      transportation_mode,
      sales_rep,
      min_value: minValue,
      max_value: maxValue,
      min_date,
      max_date
    });

    // Get count of closed lost deals
    const closedLostCount = await queryDealsCount(dealRepository, {
      stage: 'closed_lost', 
      transportation_mode,
      sales_rep,
      min_value: minValue,
      max_value: maxValue, 
      min_date,
      max_date
    });

    // Calculate win rate
    const closedDealCount = closedWonCount + closedLostCount;
    const winRate = closedDealCount > 0 
      ? Math.round((closedWonCount / closedDealCount) * 100) 
      : 0;

    return NextResponse.json({
      filters: {
        transportation_mode,
        sales_rep,
        min_value,
        max_value,
        min_date,
        max_date,
      },
      winRate: winRate,
      totalClosedDeals: closedDealCount,
      closedWonCount: closedWonCount,
      closedLostCount: closedLostCount,
    });
  } catch (error) {
    console.error("Error in GET /api/deals/historical-perf:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 