// ============================================================================
// SCHEMA DEFINITION - Define once, type everything
// ============================================================================

export type ColumnType = 'number' | 'string' | 'boolean' | 'date'
export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL'

export interface Column<T = any> {
  type: ColumnType
  nullable?: boolean
  default?: T
  unique?: boolean
  primaryKey?: boolean
}

export interface Schema {
  [table: string]: {
    [column: string]: Column
  }
}

export interface Relation {
  from: string
  to: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  foreignKey: string
  references: string
}

// ============================================================================
// TYPE UTILITIES - Extract types from schema
// ============================================================================

export type InferColumnType<C extends Column> = 
  C['type'] extends 'number' ? number :
  C['type'] extends 'string' ? string :
  C['type'] extends 'boolean' ? boolean :
  C['type'] extends 'date' ? Date :
  never

export type InferTableType<T extends Record<string, Column>> = {
  [K in keyof T]: T[K]['nullable'] extends true 
    ? InferColumnType<T[K]> | null 
    : InferColumnType<T[K]>
}

export type Keys<T> = keyof T & string

// ============================================================================
// QUERY AST - Internal representation
// ============================================================================

export interface QueryAST {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  columns?: string[]
  where?: WhereNode[]
  joins?: JoinNode[]
  orderBy?: OrderByNode[]
  groupBy?: string[]
  having?: WhereNode[]
  limit?: number
  offset?: number
  with?: CTENode[]
}

export interface WhereNode {
  type: 'condition' | 'AND' | 'OR' | 'NOT'
  field?: string
  op?: Operator
  value?: any
  children?: WhereNode[]
}

export interface JoinNode {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  table: string
  on: { left: string; right: string }
  alias?: string
}

export interface OrderByNode {
  column: string
  direction: 'ASC' | 'DESC'
}

export interface CTENode {
  name: string
  query: QueryAST
}

// ============================================================================
// QUERY BUILDER - Fluent API with type safety
// ============================================================================

export class QueryBuilder<T, TSelected = T> {
  private ast: QueryAST

  constructor(
    private schema: Schema,
    private relations: Relation[],
    table: string
  ) {
    this.ast = {
      type: 'SELECT',
      table,
      columns: [],
      where: [],
      joins: [],
      orderBy: [],
    }
  }

  // SELECT with type inference
  select<K extends Keys<T>>(...columns: K[]): QueryBuilder<T, Pick<T, K>> {
    this.ast.columns = columns as string[]
    return this as any
  }

  // WHERE with composable conditions
  where(...conditions: WhereNode[]): this {
    this.ast.where = [...(this.ast.where || []), ...conditions]
    return this
  }

  // JOIN with type-safe relations
  join<TJoin>(
    table: string,
    type: 'INNER' | 'LEFT' | 'RIGHT' = 'INNER'
  ): QueryBuilder<T & TJoin, TSelected> {
    const relation = this.relations.find(r => 
      (r.from === this.ast.table && r.to === table) ||
      (r.to === this.ast.table && r.from === table)
    )

    if (!relation) {
      throw new Error(`No relation defined between ${this.ast.table} and ${table}`)
    }

    this.ast.joins?.push({
      type,
      table,
      on: {
        left: `${this.ast.table}.${relation.foreignKey}`,
        right: `${table}.${relation.references}`,
      },
    })

    return this as any
  }

  // ORDER BY
  orderBy<K extends Keys<T>>(column: K, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.ast.orderBy?.push({ column: column as string, direction })
    return this
  }

  // GROUP BY
  groupBy<K extends Keys<T>>(...columns: K[]): this {
    this.ast.groupBy = columns as string[]
    return this
  }

  // LIMIT/OFFSET
  limit(n: number): this {
    this.ast.limit = n
    return this
  }

  offset(n: number): this {
    this.ast.offset = n
    return this
  }

  // WITH (CTE)
  with(name: string, subquery: QueryBuilder<any, any>): this {
    this.ast.with = this.ast.with || []
    this.ast.with.push({
      name,
      query: subquery.ast,
    })
    return this
  }

  // Compile to SQL
  toSQL(): { sql: string; params: any[] } {
    const compiler = new SQLCompiler()
    return compiler.compile(this.ast)
  }

  // Get AST for inspection
  getAST(): QueryAST {
    return this.ast
  }

  // Execute (placeholder - would connect to actual DB)
  async execute(): Promise<TSelected[]> {
    const { sql, params } = this.toSQL()
    console.log('SQL:', sql)
    console.log('Params:', params)
    // return await db.query(sql, params)
    return [] as TSelected[]
  }
}

// ============================================================================
// CONDITION BUILDERS - Composable WHERE clauses
// ============================================================================

export function createConditions<T>() {
  return {
    eq: <K extends Keys<T>>(field: K, value: T[K]): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: '=',
      value,
    }),

    ne: <K extends Keys<T>>(field: K, value: T[K]): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: '!=',
      value,
    }),

    gt: <K extends Keys<T>>(field: K, value: T[K]): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: '>',
      value,
    }),

    lt: <K extends Keys<T>>(field: K, value: T[K]): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: '<',
      value,
    }),

    gte: <K extends Keys<T>>(field: K, value: T[K]): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: '>=',
      value,
    }),

    lte: <K extends Keys<T>>(field: K, value: T[K]): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: '<=',
      value,
    }),

    like: <K extends Keys<T>>(field: K, pattern: string): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: 'LIKE',
      value: pattern,
    }),

    in: <K extends Keys<T>>(field: K, values: T[K][]): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: 'IN',
      value: values,
    }),

    isNull: <K extends Keys<T>>(field: K): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: 'IS NULL',
    }),

    isNotNull: <K extends Keys<T>>(field: K): WhereNode => ({
      type: 'condition',
      field: field as string,
      op: 'IS NOT NULL',
    }),

    and: (...conditions: WhereNode[]): WhereNode => ({
      type: 'AND',
      children: conditions,
    }),

    or: (...conditions: WhereNode[]): WhereNode => ({
      type: 'OR',
      children: conditions,
    }),

    not: (condition: WhereNode): WhereNode => ({
      type: 'NOT',
      children: [condition],
    }),
  }
}

// ============================================================================
// SQL COMPILER - Convert AST to SQL string
// ============================================================================

export class SQLCompiler {
  private params: any[] = []
  private paramIndex = 1

  compile(ast: QueryAST): { sql: string; params: any[] } {
    this.params = []
    this.paramIndex = 1

    let sql = ''

    // WITH (CTEs)
    if (ast.with && ast.with.length > 0) {
      const ctes = ast.with.map(cte => {
        const { sql: cteSql } = this.compile(cte.query)
        return `${cte.name} AS (${cteSql})`
      })
      sql += `WITH ${ctes.join(', ')} `
    }

    // SELECT
    sql += 'SELECT '
    sql += ast.columns?.join(', ') || '*'
    sql += ` FROM ${ast.table}`

    // JOINS
    if (ast.joins && ast.joins.length > 0) {
      ast.joins.forEach(join => {
        sql += ` ${join.type} JOIN ${join.table}`
        sql += ` ON ${join.on.left} = ${join.on.right}`
      })
    }

    // WHERE
    if (ast.where && ast.where.length > 0) {
      sql += ' WHERE '
      sql += this.compileWhereNodes(ast.where)
    }

    // GROUP BY
    if (ast.groupBy && ast.groupBy.length > 0) {
      sql += ` GROUP BY ${ast.groupBy.join(', ')}`
    }

    // HAVING
    if (ast.having && ast.having.length > 0) {
      sql += ' HAVING '
      sql += this.compileWhereNodes(ast.having)
    }

    // ORDER BY
    if (ast.orderBy && ast.orderBy.length > 0) {
      const orderClauses = ast.orderBy.map(o => `${o.column} ${o.direction}`)
      sql += ` ORDER BY ${orderClauses.join(', ')}`
    }

    // LIMIT/OFFSET
    if (ast.limit !== undefined) {
      sql += ` LIMIT ${ast.limit}`
    }
    if (ast.offset !== undefined) {
      sql += ` OFFSET ${ast.offset}`
    }

    return { sql, params: this.params }
  }

  private compileWhereNodes(nodes: WhereNode[]): string {
    if (nodes.length === 0) return ''

    return nodes.map(node => this.compileWhereNode(node)).join(' AND ')
  }

  private compileWhereNode(node: WhereNode): string {
    switch (node.type) {
      case 'condition':
        if (node.op === 'IS NULL' || node.op === 'IS NOT NULL') {
          return `${node.field} ${node.op}`
        }
        if (node.op === 'IN') {
          // Fix: push each individual value, not the whole array
          const placeholders = (node.value as any[]).map((val) => {
            this.params.push(val)  // Push individual value
            return `$${this.paramIndex++}`
          })
          return `${node.field} IN (${placeholders.join(', ')})`
        }
        this.params.push(node.value)
        return `${node.field} ${node.op} $${this.paramIndex++}`

      case 'AND':
        return `(${node.children?.map(c => this.compileWhereNode(c)).join(' AND ')})`

      case 'OR':
        return `(${node.children?.map(c => this.compileWhereNode(c)).join(' OR ')})`

      case 'NOT':
        return `NOT (${node.children?.map(c => this.compileWhereNode(c)).join(' ')})`

      default:
        return ''
    }
  }
}

// ============================================================================
// DATABASE CLIENT - Main entry point
// ============================================================================

export class Database<S extends Schema> {
  constructor(
    private schema: S,
    private relations: Relation[] = []
  ) {}

  table<T extends keyof S>(name: T) {
    type TableType = InferTableType<S[T]>
    const conditions = createConditions<TableType>()

    return {
      query: () => new QueryBuilder<TableType, TableType>(
        this.schema,
        this.relations,
        name as string
      ),
      ...conditions,
    }
  }
}
