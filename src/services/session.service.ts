import UserModel from '../models/User.model'

/** Invalidate refresh token and force new login on next access/refresh. */
export async function revokeUserSessions(userId: string) {
  await UserModel.updateOne({ _id: userId }, { $inc: { authVersion: 1 }, $unset: { refreshToken: '' } })
}

export async function bumpAuthVersion(userId: string) {
  await UserModel.updateOne({ _id: userId }, { $inc: { authVersion: 1 } })
}
