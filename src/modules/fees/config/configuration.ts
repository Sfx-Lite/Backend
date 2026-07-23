export default () => ({
  app: {
    name: process.env.APP_NAME,
    port: Number(process.env.PORT),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
  },

  throttle: {
    ttlSeconds: Number(process.env.THROTTLE_TTL_SECONDS),
    limitIp: Number(process.env.THROTTLE_LIMIT_IP),
    limitUser: Number(process.env.THROTTLE_LIMIT_USER),
  },

  fees: {
    localPercentage: Number(
      process.env.LOCAL_TRANSFER_FEE_PERCENTAGE ?? 0.01,
    ),

    internationalPercentage: Number(
      process.env.INTERNATIONAL_TRANSFER_FEE_PERCENTAGE ?? 0.02,
    ),

    minimumFee: Number(
      process.env.MINIMUM_TRANSFER_FEE ?? 0.5,
    ),

    maximumFee: Number(
      process.env.MAXIMUM_TRANSFER_FEE ?? 25,
    ),
  },
});