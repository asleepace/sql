// query-builder.test.ts
import { describe, test, expect } from 'bun:test'
import { Database, type Schema, type Relation } from '..'

// Import your query builder classes (assuming they're in a separate file)
// import { Database, mySchema, relations } from './query-builder'

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

// Define schema
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
  comments: {
    id: { type: 'number' as const, primaryKey: true },
    post_id: { type: 'number' as const },
    user_id: { type: 'number' as const },
    text: { type: 'string' as const },
  },
} satisfies Schema

// Define relations
const relations: Relation[] = [
  {
    from: 'posts',
    to: 'users',
    type: 'one-to-many',
    foreignKey: 'author_id',
    references: 'id',
  },
  {
    from: 'comments',
    to: 'posts',
    type: 'one-to-many',
    foreignKey: 'post_id',
    references: 'id',
  },
  {
    from: 'comments',
    to: 'users',
    type: 'one-to-many',
    foreignKey: 'user_id',
    references: 'id',
  },
]


// Or if everything is in one file, just ensure the classes are defined above

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Query Builder', () => {
  const db = new Database(mySchema, relations)

  describe('SELECT queries', () => {
    test('simple SELECT with WHERE and ORDER BY', () => {
      const query = db.table('users').query()
        .select('id', 'email', 'name')
        .where(db.table('users').eq('status', 'active'))
        .orderBy('created_at', 'DESC')
        .limit(10)

      const { sql, params } = query.toSQL()

      expect(sql).toContain('SELECT id, email, name')
      expect(sql).toContain('FROM users')
      expect(sql).toContain('WHERE status = $1')
      expect(sql).toContain('ORDER BY created_at DESC')
      expect(sql).toContain('LIMIT 10')
      expect(params).toEqual(['active'])
    })

    test('SELECT all columns', () => {
      const query = db.table('users').query()

      const { sql } = query.toSQL()

      expect(sql).toContain('SELECT * FROM users')
    })

    test('multiple ORDER BY clauses', () => {
      const query = db.table('users').query()
        .orderBy('status', 'ASC')
        .orderBy('created_at', 'DESC')

      const { sql } = query.toSQL()

      expect(sql).toContain('ORDER BY status ASC, created_at DESC')
    })

    test('OFFSET with LIMIT', () => {
      const query = db.table('users').query()
        .limit(20)
        .offset(40)

      const { sql } = query.toSQL()

      expect(sql).toContain('LIMIT 20')
      expect(sql).toContain('OFFSET 40')
    })
  })

  describe('WHERE conditions', () => {
    test('complex WHERE with AND/OR conditions', () => {
      const query = db.table('users').query()
        .where(
          db.table('users').or(
            db.table('users').eq('status', 'active'),
            db.table('users').and(
              db.table('users').eq('status', 'pending'),
              db.table('users').gt('age', 18)
            )
          )
        )

      const { sql, params } = query.toSQL()

      expect(sql).toContain('WHERE')
      expect(sql).toContain('OR')
      expect(sql).toContain('AND')
      expect(sql).toContain('status = $1')
      expect(sql).toContain('status = $2')
      expect(sql).toContain('age > $3')
      expect(params).toEqual(['active', 'pending', 18])
    })

    test('NULL checks', () => {
      const query = db.table('users').query()
        .where(
          db.table('users').isNotNull('age'),
          db.table('users').like('email', '%@gmail.com')
        )

      const { sql, params } = query.toSQL()

      expect(sql).toContain('WHERE')
      expect(sql).toContain('age IS NOT NULL')
      expect(sql).toContain('email LIKE $1')
      expect(params).toEqual(['%@gmail.com'])
    })

    test('IN operator with array', () => {
      const query = db.table('users').query()
        .where(db.table('users').in('status', ['active', 'pending', 'verified']))
    
      const { sql, params } = query.toSQL()
    
      expect(sql).toContain('status IN')
      expect(sql).toContain('$1, $2, $3')  // Should have 3 placeholders
      expect(params).toEqual(['active', 'pending', 'verified'])  // Individual values, not nested array
    })

    test('NOT condition', () => {
      const query = db.table('users').query()
        .where(
          db.table('users').not(
            db.table('users').eq('status', 'banned')
          )
        )

      const { sql, params } = query.toSQL()

      expect(sql).toContain('NOT')
      expect(sql).toContain('status = $1')
      expect(params).toEqual(['banned'])
    })

    test('comparison operators (gt, lt, gte, lte, ne)', () => {
      const query = db.table('users').query()
        .where(
          db.table('users').gt('age', 18),
          db.table('users').lt('age', 65),
          db.table('users').ne('status', 'deleted')
        )

      const { sql, params } = query.toSQL()

      expect(sql).toContain('age > $1')
      expect(sql).toContain('age < $2')
      expect(sql).toContain('status != $3')
      expect(params).toEqual([18, 65, 'deleted'])
    })
  })

  describe('JOINs', () => {
    test('INNER JOIN with relations', () => {
      const query = db.table('posts').query()
        .select('title', 'content')
        .join('users', 'INNER')
        .where(db.table('posts').eq('published', true))
        .orderBy('views', 'DESC')

      const { sql, params } = query.toSQL()

      expect(sql).toContain('SELECT title, content')
      expect(sql).toContain('FROM posts')
      expect(sql).toContain('INNER JOIN users')
      expect(sql).toContain('ON posts.author_id = users.id')
      expect(sql).toContain('WHERE published = $1')
      expect(sql).toContain('ORDER BY views DESC')
      expect(params).toEqual([true])
    })

    test('multiple JOINs', () => {
      const query = db.table('comments').query()
        .join('posts', 'INNER')
        .join('users', 'LEFT')

      const { sql } = query.toSQL()

      expect(sql).toContain('INNER JOIN posts')
      expect(sql).toContain('ON comments.post_id = posts.id')
      expect(sql).toContain('LEFT JOIN users')
      expect(sql).toContain('ON comments.user_id = users.id')
    })
  })

  describe('Advanced features', () => {
    test('subquery with CTE (WITH clause)', () => {
      const activeUsers = db.table('users').query()
        .select('id', 'name')
        .where(db.table('users').eq('status', 'active'))

      const query = db.table('posts').query()
        .with('active_users', activeUsers)
        .where(db.table('posts').in('author_id', [1, 2, 3]))

      const { sql, params } = query.toSQL()

      expect(sql).toContain('WITH active_users AS')
      expect(sql).toContain('SELECT id, name FROM users')
      expect(sql).toContain('WHERE status = $1')
      expect(sql).toContain('SELECT * FROM posts')
      expect(sql).toContain('author_id IN')
      expect(params[0]).toBe('active')
    })

    test('GROUP BY clause', () => {
      const query = db.table('posts').query()
        .select('author_id')
        .groupBy('author_id')

      const { sql } = query.toSQL()

      expect(sql).toContain('GROUP BY author_id')
    })

    test('AST structure is correct', () => {
      const query = db.table('users').query()
        .select('id', 'email')
        .where(db.table('users').eq('status', 'active'))
        .limit(5)

      const ast = query.getAST()

      expect(ast.type).toBe('SELECT')
      expect(ast.table).toBe('users')
      expect(ast.columns).toEqual(['id', 'email'])
      expect(ast.limit).toBe(5)
      expect(ast.where?.length).toBe(1)
    })
  })

  describe('Edge cases', () => {
    test('empty WHERE returns all records', () => {
      const query = db.table('users').query()

      const { sql } = query.toSQL()

      expect(sql).toContain('SELECT * FROM users')
      expect(sql).not.toContain('WHERE')
    })

    test('chaining methods works correctly', () => {
      const query = db.table('users').query()
        .select('id')
        .where(db.table('users').eq('status', 'active'))
        .orderBy('id', 'ASC')
        .limit(10)
        .offset(5)

      const { sql, params } = query.toSQL()

      expect(sql).toContain('SELECT id')
      expect(sql).toContain('WHERE status = $1')
      expect(sql).toContain('ORDER BY id ASC')
      expect(sql).toContain('LIMIT 10')
      expect(sql).toContain('OFFSET 5')
      expect(params).toEqual(['active'])
    })
  })
})