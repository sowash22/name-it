# Database Documentation

## Overview
This project uses **Firebase Firestore** as the primary database for storing and retrieving pet names. The database stores generated names with metadata including pet types, characteristics, name styles, and generation details.

## Database Structure

### Collection: `names`
Each document contains:
- `name`: The pet name (string)
- `meaning`: Meaning/symbolism behind the name (string)
- `origin`: Cultural or linguistic origin (string)
- `petTypes`: Array of pet types (e.g., ["dog", "cat"])
- `petCharacteristics`: Array of characteristics (e.g., ["male", "playful"])
- `nameStyles`: Array of name styles (e.g., ["english", "french"])
- `petDescription`: User's description of their pet (string)
- `numberOfImagesAttached`: Count of uploaded images (number)
- `createdAt`: Timestamp when name was generated (timestamp)
- `generatedBy`: Source of generation (string, e.g., "llm")

### Example Document
```json
{
  "name": "Fleur de Joie",
  "meaning": "Flower of Joy. 'Fleur' represents beauty and daintiness...",
  "origin": "French",
  "petTypes": ["cat"],
  "petCharacteristics": ["female", "playful"],
  "nameStyles": ["french", "unique"],
  "petDescription": "I Love My Pet",
  "numberOfImagesAttached": 0,
  "createdAt": "2025-08-22T07:01:53.000Z",
  "generatedBy": "llm"
}
```

## Setup

### 1. Environment Variables
```bash
# Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Database Usage Control
USE_DB_DATA=true  # Set to 'true' to use database, 'false' for LLM generation

# Number of names to return
NEXT_PUBLIC_TOP_NAMES=5
```

### 2. Firebase Configuration
- Ensure `firebaseAdmin.ts` is properly configured
- Service account key should have Firestore read/write permissions

### 3. Required Indexes
**Composite Index for queries:**
- Collection: `names`
- Fields:
  - `petTypes` (Array)
  - `createdAt` (Ascending)
  - `__name__` (Ascending)

## Common Errors & Solutions

### 1. "A maximum of 1 'ARRAY_CONTAINS' filter is allowed per disjunction"
**Problem**: Firestore only allows one array filter per query, but we were trying to filter by multiple arrays simultaneously.

**Solution**: Implemented hybrid filtering:
- Use one `array-contains-any` filter in Firestore query
- Apply remaining filters in memory after fetching results

**Code Location**: `src/app/api/generate-names/route.ts` - `readNamesFromDatabase()` function

### 2. "The query requires an index"
**Problem**: Combining `array-contains-any` with `orderBy` requires a composite index.

**Solution**: Create the required composite index in Firebase Console:
1. Go to Firestore → Indexes
2. Click "Create Index"
3. Select Collection (not Collection Group)
4. Add fields: `petTypes` (Array), `createdAt` (Ascending), `__name__` (Ascending)

## How It Works

### Query Strategy
1. **Primary Filter Selection**: Choose the most specific filter (petTypes → nameStyles → petCharacteristics)
2. **Firestore Query**: Execute single `array-contains-any` filter with increased limit
3. **In-Memory Filtering**: Apply remaining criteria to results
4. **Result Processing**: Sort, limit, and return final names

### Why This Approach?
- **Firestore Limitation**: Only one array filter per query
- **Performance**: Minimize database calls while maintaining accuracy
- **Flexibility**: Support complex multi-criteria searches

### Data Flow
```
User Request → Primary Filter (Firestore) → In-Memory Filtering → Final Results
```

## Usage Examples

### Basic Query
```typescript
// Request
{
  "petTypes": ["dog"],
  "petCharacteristics": ["male"],
  "nameStyles": ["english"]
}

// What Happens
1. Firestore: WHERE petTypes CONTAINS ANY ["dog"]
2. Memory: Filter for male characteristics AND English styles
3. Return: Names matching all criteria
```

### Fallback Strategy
- If database query fails → Use local mock data
- If no database results → Fall back to mock data
- If LLM generation fails → Use mock data

## Best Practices

1. **Index Management**: Always create required indexes before deploying
2. **Error Handling**: Graceful fallbacks to ensure user experience
3. **Query Optimization**: Use most specific filter for primary Firestore query
4. **Result Limiting**: Fetch 3x more results than needed for effective in-memory filtering

## Troubleshooting

### Database Not Working
- Check `USE_DB_DATA=true` environment variable
- Verify Firebase credentials and permissions
- Ensure required indexes are built and enabled

### Slow Queries
- Check if indexes are properly configured
- Consider reducing the multiplier (currently 3x) for in-memory filtering
- Monitor Firestore usage and costs

### Missing Results
- Verify all required fields are present in documents
- Check if in-memory filtering is too restrictive
- Ensure primary filter is selecting the right subset of data
