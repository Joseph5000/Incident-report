/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Service to handle WebAuthn / Biometric Authentication
 */

export const isBiometricsAvailable = (): boolean => {
  return !!(window.PublicKeyCredential && 
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable);
};

export async function registerBiometrics(): Promise<boolean> {
  if (!isBiometricsAvailable()) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: "ShieldReport Tactical",
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: "officer@shieldreport.local",
        displayName: "Field Officer",
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    });

    return !!credential;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      console.error("Biometric registration blocked by Permissions Policy or User Context:", err);
      throw new Error("BIOMETRIC_POLICY_RESTRICTION");
    }
    console.error("Biometric registration failed:", err);
    return false;
  }
}

export async function authenticateBiometrics(): Promise<boolean> {
  if (!isBiometricsAvailable()) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [], // Allow any registered platform credential
      userVerification: "required",
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });

    return !!assertion;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      console.error("Biometric authentication blocked by Permissions Policy or User Context:", err);
      throw new Error("BIOMETRIC_POLICY_RESTRICTION");
    }
    console.error("Biometric authentication failed:", err);
    return false;
  }
}
