export const INIT_DATE = '2023-01-06T13:00:00.000Z';

const priceQueryGroup = `SELECT
    $__timeGroupAlias("timestamp",'1h'),
    max(price) AS "price"
  FROM pair_price
  `;

const priceQuery = `SELECT
    timestamp AS "time",
    max(price) AS "price"
  FROM pair_price
  `;

export function buildPriceQuery(assetIn: string, assetOut: string, endOfDay: string) {
  return `
    WITH nor_trades AS (
      SELECT 
        timestamp,
        block.height AS block,
        args->>'who' AS who,
        name AS operation,
        token_metadata_in.symbol AS asset_in,
        token_metadata_out.symbol AS asset_out,
        (args->>'amountIn')::numeric / (10 ^ token_metadata_in.decimals) AS amount_in,
        (args->>'amountOut')::numeric / (10 ^ token_metadata_out.decimals) AS amount_out
      FROM event 
      INNER JOIN block ON block_id = block.id
      INNER JOIN token_metadata AS token_metadata_in ON (args->>'assetIn')::integer = token_metadata_in.id
      INNER JOIN token_metadata AS token_metadata_out ON (args->>'assetOut')::integer = token_metadata_out.id
      WHERE name IN ('Omnipool.BuyExecuted', 'Omnipool.SellExecuted')
        AND timestamp BETWEEN '${INIT_DATE}' AND '${endOfDay}'
    ),
    pair_price AS (
      SELECT 
        timestamp,
        CASE 
          WHEN asset_in = '${assetIn}' AND asset_out = '${assetOut}' THEN amount_in / amount_out
          WHEN asset_in = '${assetOut}' AND asset_out = '${assetIn}' THEN amount_out / amount_in
        END AS price
      FROM nor_trades
    )
    ${priceQueryGroup}
    WHERE price IS NOT NULL
    GROUP BY 1
    ORDER BY 1;
    `;
}

const volumeQuery = `SELECT
    $__timeGroupAlias("timestamp",'1h'),
    sum(volume) AS "volume (hourly)"
  FROM volume
  `;

export function buildVolumeQuery(assetIn: string, assetOut: string, endOfDay: string) {
  return `WITH volume AS (SELECT 
    timestamp,
    amount_in AS volume
   FROM normalized_trades
   WHERE asset_in = '${assetIn}' AND asset_out = '${assetOut}' 
   AND "timestamp" BETWEEN '${INIT_DATE}' AND '${endOfDay}' 
   UNION ALL
   SELECT 
    timestamp,
    amount_out AS volume
   FROM normalized_trades
   WHERE asset_in = '${assetOut}' AND asset_out = '${assetIn}' 
   AND "timestamp" BETWEEN '${INIT_DATE}' AND '${endOfDay}' 
   ORDER BY timestamp)
   ${volumeQuery} 
   WHERE
    "timestamp" BETWEEN '${INIT_DATE}' AND '${endOfDay}' 
   GROUP BY 1
   ORDER BY 1`;
}
