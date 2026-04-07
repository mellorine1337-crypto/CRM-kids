const { prisma } = require("../lib/prisma");
const { verifyAccessToken } = require("../lib/tokens");

const requireAuth = async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return next({ status: 401, message: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return next({ status: 401, message: "User not found" });
    }

    req.user = user;
    next();
  } catch (_error) {
    next({ status: 401, message: "Invalid or expired access token" });
  }
};

const requireRoles = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next({ status: 401, message: "Authentication required" });
  }

  if (!roles.includes(req.user.role)) {
    return next({ status: 403, message: "Insufficient permissions" });
  }

  next();
};

module.exports = { requireAuth, requireRoles };
