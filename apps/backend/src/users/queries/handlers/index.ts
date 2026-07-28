import { GetUserByIdHandler } from "./get-user-by-id.handler";
import { VerifyUserCredentialsHandler } from "./verify-user-credentials.handler";

/** Same registration rule as USERS_COMMAND_HANDLERS — miss one and the bus throws. */
export const USERS_QUERY_HANDLERS = [GetUserByIdHandler, VerifyUserCredentialsHandler];

export { GetUserByIdHandler, VerifyUserCredentialsHandler };
