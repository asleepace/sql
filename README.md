# SQL Query Builder

A modern, type-safe SQL query builder for TypeScript with full schema inference and compile-time type checking.

## Features

✨ **Type-Safe** - Full TypeScript support with schema inference  
🔍 **Autocomplete** - IDE autocomplete for table columns and types  
🔗 **Relation-Aware** - Auto-validates joins based on defined relationships  
🎯 **Composable** - Build complex queries with AND/OR/NOT logic  
🛡️ **SQL Injection Safe** - Automatic parameterization ($1, $2...)  
🚀 **Fast** - Built for Bun runtime with zero dependencies  
📦 **Lightweight** - Small footprint, tree-shakeable  
🧪 **Well-Tested** - Comprehensive test suite included

## Installation

```bash
bun add @yourusername/sql
```

## Quick Start

### 1. Define Your Schema

```typescript
import { Database, type Schema, type Relation } from '@yourusername/sql'

const mySchema = {
  users: {
    id: { type: 'number' as const, primaryKey: true },
    email: { type: 'string' as const, unique: true },
    name: { type: 'string' as const },
    age: { type: 'number' as const, nullable: true },
    status: { type: 'string' as const },
    created_at: { type: 'date' as const },
  },
  posts: {
    id: { type: 'number' as const, primaryKey: true },
    title: { type: 'string' as const },
    content: { type: 'string' as const },
    author_id: { type: 'number' as const },
    published: { type: 'boolean' as const },
    views: { type: 'number' as const },
  },
} satisfies Schema

const relations: Relation[] = [
  {
    from: 'posts',
    to: 'users',
    type: 'one-to-many',
    foreignKey: 'author_id',
    references: 'id',
  },
]

const db = new Database(mySchema, relations)
```

### 2. Build Type-Safe Queries

```typescript
// Simple SELECT with type inference
const query = db.table('users').query()
  .select('id', 'email', 'name')  // ✓ Autocomplete works!
  .where(db.table('users').eq('status', 'active'))
  .orderBy('created_at', 'DESC')
  .limit(10)

const { sql, params } = query.toSQL()
// sql: "SELECT id, email, name FROM users WHERE status = $1 ORDER BY created_at DESC LIMIT 10"
// params: ["active"]
```

## Examples

### Basic SELECT Queries

```typescript
// Select all columns
const allUsers = db.table('users').query().toSQL()
// SELECT * FROM users

// Select specific columns
const userEmails = db.table('users').query()
  .select('id', 'email')
  .toSQL()
// SELECT id, email FROM users

// With ordering
const recentUsers = db.table('users').query()
  .orderBy('created_at', 'DESC')
  .limit(5)
  .toSQL()
// SELECT * FROM users ORDER BY created_at DESC LIMIT 5

// Pagination
const page2 = db.table('users').query()
  .limit(20)
  .offset(20)
  .toSQL()
// SELECT * FROM users LIMIT 20 OFFSET 20
```

### WHERE Conditions

```typescript
// Simple equality
const activeUsers = db.table('users').query()
  .where(db.table('users').eq('status', 'active'))
  .toSQL()
// WHERE status = $1

// Comparison operators
const adults = db.table('users').query()
  .where(
    db.table('users').gt('age', 18),
    db.table('users').lt('age', 65)
  )
  .toSQL()
// WHERE age > $1 AND age < $2

// LIKE pattern matching
const gmailUsers = db.table('users').query()
  .where(db.table('users').like('email', '%@gmail.com'))
  .toSQL()
// WHERE email LIKE $1

// IN operator
const specificStatuses = db.table('users').query()
  .where(db.table('users').in('status', ['active', 'pending', 'verified']))
  .toSQL()
// WHERE status IN ($1, $2, $3)

// NULL checks
const usersWithAge = db.table('users').query()
  .where(db.table('users').isNotNull('age'))
  .toSQL()
// WHERE age IS NOT NULL
```

### Complex Conditions (AND/OR/NOT)

```typescript
// OR condition
const query1 = db.table('users').query()
  .where(
    db.table('users').or(
      db.table('users').eq('status', 'active'),
      db.table('users').eq('status', 'verified')
    )
  )
  .toSQL()
// WHERE (status = $1 OR status = $2)

// Nested AND/OR
const query2 = db.table('users').query()
  .where(
    db.table('users').or(
      db.table('users').eq('status', 'active'),
      db.table('users').and(
        db.table('users').eq('status', 'pending'),
        db.table('users').gt('age', 18)
      )
    )
  )
  .toSQL()
// WHERE (status = $1 OR (status = $2 AND age > $3))

// NOT condition
const notBanned = db.table('users').query()
  .where(
    db.table('users').not(
      db.table('users').eq('status', 'banned')
    )
  )
  .toSQL()
// WHERE NOT (status = $1)
```

### JOINs

```typescript
// Simple INNER JOIN
const postsWithAuthors = db.table('posts').query()
  .select('title', 'content')
  .join('users', 'INNER')
  .toSQL()
// SELECT title, content FROM posts
// INNER JOIN users ON posts.author_id = users.id

// LEFT JOIN with conditions
const publishedPosts = db.table('posts').query()
  .join('users', 'LEFT')
  .where(db.table('posts').eq('published', true))
  .orderBy('views', 'DESC')
  .toSQL()

// Multiple JOINs
const commentsWithData = db.table('comments').query()
  .join('posts', 'INNER')
  .join('users', 'INNER')
  .toSQL()
```

### GROUP BY

```typescript
// Group by single column
const postsByAuthor = db.table('posts').query()
  .select('author_id')
  .groupBy('author_id')
  .toSQL()
// SELECT author_id FROM posts GROUP BY author_id

// Multiple columns
const grouped = db.table('posts').query()
  .groupBy('author_id', 'published')
  .toSQL()
```

### CTEs (Common Table Expressions)

```typescript
// WITH clause for subqueries
const activeUsers = db.table('users').query()
  .select('id', 'name')
  .where(db.table('users').eq('status', 'active'))

const postsFromActiveUsers = db.table('posts').query()
  .with('active_users', activeUsers)
  .where(db.table('posts').in('author_id', [1, 2, 3]))
  .toSQL()

// Result:
// WITH active_users AS (
//   SELECT id, name FROM users WHERE status = $1
// )
// SELECT * FROM posts WHERE author_id IN ($2, $3, $4)
```

### Advanced Usage

```typescript
// Inspect the AST (Abstract Syntax Tree)
const query = db.table('users').query()
  .select('id', 'email')
  .where(db.table('users').eq('status', 'active'))

const ast = query.getAST()
console.log(ast)
// {
//   type: 'SELECT',
//   table: 'users',
//   columns: ['id', 'email'],
//   where: [{ type: 'condition', field: 'status', op: '=', value: 'active' }],
//   ...
// }

// Reusable query fragments
const activeUsersCondition = db.table('users').eq('status', 'active')
const adultCondition = db.table('users').gt('age', 18)

const query1 = db.table('users').query()
  .where(activeUsersCondition)

const query2 = db.table('users').query()
  .where(activeUsersCondition, adultCondition)
```

## API Reference

### Database

```typescript
class Database<S extends Schema>
```

**Methods:**
- `table<T>(name: keyof S)` - Get a table builder with typed conditions

### QueryBuilder

```typescript
class QueryBuilder<T, TSelected = T>
```

**Methods:**
- `select<K>(...columns: K[])` - Select specific columns
- `where(...conditions: WhereNode[])` - Add WHERE conditions
- `join<TJoin>(table: string, type?: 'INNER' | 'LEFT' | 'RIGHT')` - Join tables
- `orderBy<K>(column: K, direction?: 'ASC' | 'DESC')` - Order results
- `groupBy<K>(...columns: K[])` - Group by columns
- `limit(n: number)` - Limit results
- `offset(n: number)` - Skip results
- `with(name: string, subquery: QueryBuilder)` - Add CTE
- `toSQL()` - Compile to SQL string with parameters
- `getAST()` - Get query AST
- `execute()` - Execute query (requires DB connection)

### Condition Builders

Available for each table via `db.table('tableName')`:

```typescript
// Comparison
eq(field, value)       // field = value
ne(field, value)       // field != value
gt(field, value)       // field > value
lt(field, value)       // field < value
gte(field, value)      // field >= value
lte(field, value)      // field <= value

// Pattern matching
like(field, pattern)   // field LIKE pattern

// Array operations
in(field, values[])    // field IN (...)

// NULL checks
isNull(field)          // field IS NULL
isNotNull(field)       // field IS NOT NULL

// Logical operators
and(...conditions)     // (... AND ...)
or(...conditions)      // (... OR ...)
not(condition)         // NOT (...)
```

## Type Safety Features

### Schema Inference

```typescript
// TypeScript knows all valid columns
const query = db.table('users').query()
  .select('id', 'email')    // ✓ Valid
  .select('invalid')         // ✗ TypeScript error!

// Value types are enforced
db.table('users').eq('status', 'active')  // ✓ Valid
db.table('users').eq('status', 123)       // ✗ TypeScript error!
db.table('users').eq('age', 25)           // ✓ Valid
db.table('users').eq('age', 'text')       // ✗ TypeScript error!
```

### Nullable Fields

```typescript
const schema = {
  users: {
    age: { type: 'number' as const, nullable: true },
  },
} satisfies Schema

// TypeScript knows age can be null
type User = InferTableType<typeof schema.users>
// { age: number | null }
```

### Relation Validation

```typescript
// JOINs are validated against defined relations
db.table('posts').query()
  .join('users', 'INNER')  // ✓ Valid (relation exists)

db.table('posts').query()
  .join('invalid', 'INNER')  // ✗ Runtime error: No relation defined
```

## Testing

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Coverage
bun test --coverage

# Type check
bun run typecheck
```

### Example Test

```typescript
import { describe, test, expect } from 'bun:test'

describe('Query Builder', () => {
  test('generates correct SQL', () => {
    const query = db.table('users').query()
      .select('id', 'email')
      .where(db.table('users').eq('status', 'active'))

    const { sql, params } = query.toSQL()

    expect(sql).toContain('SELECT id, email FROM users')
    expect(sql).toContain('WHERE status = $1')
    expect(params).toEqual(['active'])
  })
})
```

## Performance

- **Zero runtime overhead** - All type checking happens at compile time
- **Lazy compilation** - SQL only generated when `toSQL()` is called
- **Parameterized queries** - Prepared statements for security and performance
- **Tree-shakeable** - Only bundle what you use

## Roadmap

- [ ] Aggregation functions (COUNT, SUM, AVG, etc.)
- [ ] UPDATE queries
- [ ] INSERT queries
- [ ] DELETE queries
- [ ] HAVING clause
- [ ] Subqueries in SELECT
- [ ] UNION/INTERSECT/EXCEPT
- [ ] Transactions
- [ ] Migration system
- [ ] Database connection pooling
- [ ] Multiple database dialect support (MySQL, SQLite, etc.)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

```bash
# Clone the repo
git clone https://github.com/yourusername/sql.git

# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck
```

## License

MIT © Colin

## Acknowledgments

Inspired by:
- [Drizzle ORM](https://orm.drizzle.team/)
- [Kysely](https://kysely.dev/)
- [Prisma](https://www.prisma.io/)
- [Zod](https://zod.dev/)

---

**Built with ❤️ using [Bun](https://bun.sh) and TypeScript**