export interface IQueryContext {
    token: string | undefined,
    tokenData: {
        exp: number
    }
}