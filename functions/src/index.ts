import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

export const addAdminRole = onCall<{ uid: string }>(
    async (request) => {
        // Only existing admins can promote
        if (!request.auth?.token.admin) {
            throw new HttpsError(
                "permission-denied",
                "Only admins can add other admins."
            );
        }

        await admin.auth().setCustomUserClaims(request.data.uid, { admin: true });
        return { message: `User ${request.data.uid} is now an admin.` };
    }
);
