// Кратко: оборачивает async-роуты, чтобы ошибки уходили в общий error handler.
const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

module.exports = { asyncHandler };
