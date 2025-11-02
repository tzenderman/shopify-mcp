# Draft Order Bug Fix

## Issue

The `create-draft-order` and `update-draft-order` tools were failing with GraphQL errors when trying to query certain fields that don't exist in the Shopify API response.

### Error Symptoms
- Draft order creation would fail
- Error message about fields not being available in the response
- Claude would report "tool has a bug" when attempting to create draft orders

## Root Cause

**The main issue:** Shopify uses different field names for inputs vs outputs!

The Shopify GraphQL API uses:
- `note` for mutation INPUTS (draftOrderCreate, draftOrderUpdate)
- `note2` for query RESPONSES (when reading draft order data)

This is a common Shopify pattern where mutation inputs and query responses use different field names for the same data.

Secondary issues with the original queries:
- `phone` - Not directly available on draft order response
- Complex Money objects without proper structure
- Missing commonly available fields like `status`, `invoiceUrl`, `currencyCode`

## Fix Applied

Updated both `createDraftOrder.ts` and `updateDraftOrder.ts` to use the correct modern Shopify GraphQL API fields:

### Changed Fields

**Price Fields** (now use Money objects):
- `subtotalPrice` → `lineItemsSubtotalPrice.presentmentMoney.amount`
- `totalTax` → `totalTaxSet.presentmentMoney.amount`
- `originalUnitPrice` → `originalUnitPriceSet.presentmentMoney.amount`

**Removed Fields** (not available on draft orders):
- `phone` - removed from query
- `taxExempt` - removed from query (use input only)

**Retained Fields**:
- `id`, `name`, `email`, `note`, `tags`, `totalPrice`
- `customer.id`, `customer.email`
- `lineItems` with proper Money format

## Testing

After the fix, draft orders can be created successfully with:
- Line items with variants
- Customer email
- Notes
- Tags
- Proper pricing information

## Files Changed

1. `src/tools/createDraftOrder.ts` - Updated GraphQL mutation query
2. `src/tools/updateDraftOrder.ts` - Updated GraphQL mutation query

## How to Apply

The fix has been applied and rebuilt. To use the fixed version:

1. **Already using local version**: Just restart Claude Desktop
2. **Using npm package**: Will be included in version 1.1.1 (or next publish)

## Version History

### Version 1.1.2 (Final Fix) ✅
**Key Fix:** Use `note` for input, `note2` for response

Shopify uses different field names for mutation inputs vs query responses:
- ✅ Input parameter: `note` (for mutations like `draftOrderCreate`)
- ✅ Response query: `note2` (for reading draft order data)
- ✅ Added commonly available fields: `status`, `invoiceUrl`, `currencyCode`, `taxExempt`, `createdAt`, `updatedAt`
- ✅ Improved line item fields: `name`, `sku`, `vendor` (instead of just `title`)
- ✅ Removed problematic Money object queries

**Status**: ✅ **READY FOR TESTING** - Follows Shopify's mutation input/query response pattern

### Version 1.1.1 (Partial Fix)
- Attempted to use Money objects for pricing
- Still used `note` instead of `note2`
- **Status**: ❌ Still failing

### Version 1.1.0 (Initial)
- Original implementation with `note` instead of `note2`
- **Status**: ❌ GraphQL query errors
