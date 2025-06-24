import z from "zod";
import { Deal } from "../entities/deals/Deal";
import { DealDataSchema } from "../entities/deals/interface";
import { Repository } from "typeorm";

export async function validateAndSaveDeal(
  deal: any,
  dealRepository: any
): Promise<{ success: boolean; deal_id: string; error: any }> {
  try {
    const dealData = DealDataSchema.parse(deal);

    // Check for duplicate deals
    const existingDeal = await checkForDuplicateDeal(
      dealData.deal_id,
      dealRepository
    );
    if (existingDeal) {
      return {
        success: false,
        error: "Duplicate deal_id",
        deal_id: dealData.deal_id,
      };
    }

    // Save the deal to the database
    const newDeal = dealRepository.create(dealData);
    await dealRepository.save(newDeal);
    return { success: true, deal_id: dealData.deal_id, error: undefined };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors,
        deal_id: deal.deal_id,
      };
    }
    return {
      success: false,
      error: "Internal server error",
      deal_id: deal.deal_id,
    };
  }
}

// Function to check for duplicate deals
async function checkForDuplicateDeal(
  deal_id: string,
  dealRepository: any
): Promise<Deal | null> {
  return await dealRepository.findOneBy({ deal_id });
}

export async function queryDealsCount(dealRepository: Repository<Deal>, filters: {
  stage: string
  transportation_mode: string | null,
  sales_rep: string | null,
  min_value: number | null,
  max_value: number | null,
  min_date: string | null,
  max_date: string | null
}) {
  let queryBuilder = dealRepository.createQueryBuilder('deal');

  queryBuilder = queryBuilder.andWhere('deal.stage = :stage',
    { stage: filters.stage });
  
  if (filters.transportation_mode) {
    queryBuilder = queryBuilder.andWhere('deal.transportation_mode = :transportation_mode',
      { transportation_mode: filters.transportation_mode });
  }

  if (filters.sales_rep) {
    queryBuilder = queryBuilder.andWhere('deal.sales_rep = :sales_rep',
      { sales_rep: filters.sales_rep });
  }

  if (filters.min_value) {
    const minValue = parseFloat(filters.min_value);
    if (!isNaN(minValue)) {
      queryBuilder = queryBuilder.andWhere('deal.value >= :min_value',
        { min_value: minValue });
    }
  }

  if (filters.max_value) {
    const maxValue = parseFloat(filters.max_value);
    if (!isNaN(maxValue)) {
      queryBuilder = queryBuilder.andWhere('deal.value <= :max_value',
        { max_value: maxValue });
    }
  }

  if (filters.min_date) {
    queryBuilder = queryBuilder.andWhere('deal.created_date >= :min_date',
      { min_date: filters.min_date });
  }

  if (filters.max_date) {
    queryBuilder = queryBuilder.andWhere('deal.created_date <= :max_date',
      { max_date: filters.max_date });
  }

  return queryBuilder.getCount();
}