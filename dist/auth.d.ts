export interface AuthInfo {
    readonly authMode: "chatgpt";
    readonly email: string | null;
    readonly userId: string;
    readonly accountId: string;
    readonly recordKey: string;
    readonly plan: string | null;
    readonly accessToken: string | null;
    readonly snapshotFile: string;
}
interface AuthClaims {
    readonly chatgpt_account_id?: unknown;
    readonly chatgpt_plan_type?: unknown;
    readonly chatgpt_user_id?: unknown;
    readonly user_id?: unknown;
}
interface JwtPayload {
    readonly email?: unknown;
    readonly "https://api.openai.com/auth"?: AuthClaims;
}
export declare function decodeJwtPayload(idToken: string): JwtPayload;
export declare function parseAuthText(text: string): AuthInfo;
export declare function parseAuthFile(filePath: string): AuthInfo;
export declare function redactedAuthInfo(info: AuthInfo): Omit<AuthInfo, "accessToken">;
export {};
