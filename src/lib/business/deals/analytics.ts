import { initializeDataSource } from "@/data-source";
import { Deal } from "../../entities/deals/Deal";
import { queryDealsCount } from "@/lib/persistence/deals";

export function getStageAnalytics(deals: Deal[]): {
  totalDeals: number;
  stageAnalytics: Record<
    string,
    { deals: Deal[]; count: number; percentage: number }
  >;
} {
  const dealsByStage = getDealsByStage(deals);
  // Calculate totals and percentages
  const totalDeals = deals.length;
  const stageAnalytics = Object.entries(dealsByStage).reduce(
    (acc, [stage, stageDeals]) => {
      const count = stageDeals.length;
      const percentage =
        totalDeals > 0 ? Math.round((count / totalDeals) * 100) : 0;

      acc[stage] = {
        deals: stageDeals,
        count,
        percentage,
      };
      return acc;
    },
    {} as Record<string, { deals: Deal[]; count: number; percentage: number }>
  );
  return { totalDeals, stageAnalytics };
}

function getDealsByStage(deals: Deal[]): Record<string, Deal[]> {
  return deals.reduce((acc: Record<string, Deal[]>, deal: Deal) => {
    if (!acc[deal.stage]) {
      acc[deal.stage] = [];
    }
    acc[deal.stage].push(deal);
    return acc;
  }, {} as Record<string, Deal[]>);
}


// given list of deals expected to close or already closed this month, forecast the revenue
export async function forecaseRevenue(deals: Deal[]): Promise<number> {
  // Get historical win rates by transportation mode from last 90 days
  const ninetyDaysAgo = new Date(); 
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const alreadyWonDeals = deals.filter(deal => { 
    deal.stage === 'closed_won';
  });

  const dealsYetToClose = deals.filter(deal => {
    !['closed_won', 'closed_lost'].includes(deal.stage);
  });

  const historicalWinRatesByMode = await getHistoricalWinRatesByMode(); 

  const alreadyWonRevenue = alreadyWonDeals.reduce((total, deal) => {
    return total + deal.value;
  }, 0);

  const expectedRevenue = dealsYetToClose.reduce((total, deal) => {
    const modeWinRate = historicalWinRatesByMode[deal.transportation_mode];
    const dealProbability = deal.probability / 100;
    
    // Weighted probability (70% deal probability, 30% historical win rate)
    const weightedProbability = modeWinRate ? (0.7 * dealProbability) + (0.3 * modeWinRate) : dealProbability;
    
    // Expected revenue for this deal
    const dealExpectedRevenue = deal.value * weightedProbability;
    
    return total + dealExpectedRevenue;
  }, 0);

  return Math.round(expectedRevenue + alreadyWonRevenue);
}

// get the win rates by transportation mode for the last 90 days
async function getHistoricalWinRatesByMode(): Promise<Record<string, number>> {
  const dataSource = await initializeDataSource();
  const dealRepository = dataSource.getRepository(Deal);
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 90);
  const maxDate = new Date();

  const winRatesByMode: Record<string, number> = {};

  ['ocean', 'air', 'trucking', 'rail'].forEach(async (mode) => {
    
    const closedWonCount = await queryDealsCount(dealRepository, {
      stage: 'closed_won',
      transportation_mode: mode,
      sales_rep: null,
      min_value: null,
      max_value: null,
      min_date: minDate.toISOString(),
      max_date: maxDate.toISOString()
    });

  // Get count of closed lost deals
    const closedLostCount = await queryDealsCount(dealRepository, {
      stage: 'closed_lost',
      transportation_mode: mode,
      sales_rep: null,
      min_value: null,
      max_value: null,
      min_date: minDate.toISOString(),
      max_date: maxDate.toISOString()
    });

    const closedDealCount = closedWonCount + closedLostCount;
    const winRate = closedDealCount > 0
      ? Math.round((closedWonCount / closedDealCount) * 100)
      : 0;

    winRatesByMode[mode] = winRate;
  });

  return winRatesByMode;
}