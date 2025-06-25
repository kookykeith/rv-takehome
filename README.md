# Milestone 1 Path
I chose Path A because it looks like what I have the most experience with: backend APIs, deriving insights from existing data, algorithms etc

# AI Collaboration

## Historical Analysis API
I prompted with the inputs and a short description of what it should do.
```
    // Build query builder with filters
    let queryBuilder = dealRepository.createQueryBuilder('deal');

    // Apply filters if provided
    if (transportation_mode) {
      queryBuilder = queryBuilder.andWhere('deal.transportation_mode = :transportation_mode', { transportation_mode });
    }

    if (sales_rep) {
      queryBuilder = queryBuilder.andWhere('deal.sales_rep = :sales_rep', { sales_rep });
    }

    if (min_value) {
      const minValue = parseFloat(min_value);
      if (!isNaN(minValue)) {
        queryBuilder = queryBuilder.andWhere('deal.value >= :min_value', { min_value: minValue });
      }
    }

    if (max_value) {
      const maxValue = parseFloat(max_value);
      if (!isNaN(maxValue)) {
        queryBuilder = queryBuilder.andWhere('deal.value <= :max_value', { max_value: maxValue });
      }
    }

    if (min_date) {
      queryBuilder = queryBuilder.andWhere('deal.created_date >= :min_date', { min_date });
    }

    if (max_date) {
      queryBuilder = queryBuilder.andWhere('deal.created_date <= :max_date', { max_date });
    }

    // Execute query
    const deals = await queryBuilder.getMany();

    // Calculate historical performance metrics
    const performanceMetrics = calculateHistoricalPerformance(deals);
```

It was pulling all the matching records and then counting the closed_won and closed_lost records to calculate the win rate. I refactored the query into the `queryDealsCount` function and made it filterable by `stage` so I can query for just the counts for the matching Deals for each stage. This scales much better because only the count is retrieved.

## Forecast Revenue Algorithm
I forgot to save the initial output but my prompt was:
```
 Forecast next month's revenue
  1. input is list of Deals expected to close in the next 30 days
  2. pull win rates by transportation mode: ocean, air, trucking, rail for the last 90 days
  3. calculate the win probability for each deal using the deal's probability and the pulled win rate for the 
  transportation mode with 0.7 weight on the deal's probability and 0.3 weight on the pulled win rate
  4. calculate the expected revenue for each deal using the deal's value and the win probability
  5. sum the expected revenue for all Deals
  6. return the expected revenue
```
It didn't know how to pull the historical win rate, so I nudged a few time to make it use the `queryDealsCount` function like in the /historical-perf API. I also added handling for when a data for a mode is missing or if a deal is already closed.

# Demo Guide
Example call to historical performance API:
```
curl "http://localhost:3000/api/deals/historical-perf?transportation_mode=Air&sales_rep=Jane&min_value=50000&max_value=100000&min_date=2025-01-04&max_date=2025-06-30"
```
The `forcaseRevenue` (mispelled it) function should also work, but I ran out of time to hook it up to anything. 

# If I had more time
- refactor the query function to be more composable, instead of returning just the count, it can return a partially built query to be extended.
- better validations in the historical performance API
- have the forecast revenue function forecast by month
- the historical win rate queries for the forecast function can be combined together to reduce the number of DB calls. They can also be precomputed and stored in a look up table daily if performance is an issue. 

