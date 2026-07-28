import { ChangeUserPasswordHandler } from "./change-user-password.handler";
import { DeleteUserHandler } from "./delete-user.handler";
import { RegisterUserHandler } from "./register-user.handler";
import { UpdateUserProfileHandler } from "./update-user-profile.handler";

/**
 * Every handler has to reach the module's providers or the bus never learns
 * about it, and the failure only shows up at runtime as
 * CommandHandlerNotFoundException. Adding one here is the single step to
 * remember; users.cqrs.spec.ts is what catches forgetting it.
 */
export const USERS_COMMAND_HANDLERS = [
  RegisterUserHandler,
  UpdateUserProfileHandler,
  ChangeUserPasswordHandler,
  DeleteUserHandler,
];

export {
  ChangeUserPasswordHandler,
  DeleteUserHandler,
  RegisterUserHandler,
  UpdateUserProfileHandler,
};
