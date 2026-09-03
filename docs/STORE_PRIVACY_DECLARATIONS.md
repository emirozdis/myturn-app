# MyTurn store privacy declaration map

Status: source-based submission draft. Confirm against a signed iOS archive,
signed Android AAB, production provider settings, and release-build network
traffic before submitting either store form.

## Product-wide answers

- The app collects user data: **Yes**.
- Data is linked to the user's identity: **Yes** for the categories listed
  below. MyTurn attaches its account ID to Firebase Analytics, Crashlytics,
  RevenueCat, and first-party records.
- Tracking across other companies' apps or websites: **No**, based on the
  current absence of advertising SDKs, targeted advertising, or data-broker
  sharing. Revisit this answer before adding attribution or advertising SDKs.
- Data sold: **No**.
- Google Play “shared” data: provisionally **No** for transfers to contracted
  service providers and user-directed sharing inside MyTurn. Confirm each
  provider's contract and role before submission; Google defines “sharing”
  separately from transmission to a service provider.
- Encryption in transit: **Yes**, provided the release build is restricted to
  HTTPS production endpoints and the release traffic capture confirms this.
- Account deletion: **Yes** in the app and through the implemented self-service
  web flow at `https://myturn.emirozdis.tr/account`. Production deployment and
  end-to-end email/deletion verification remain release dependencies.
- Usage analytics: optional and off by default. The global setting is stored
  on-device. Turning it off disables future Firebase Analytics collection and
  resets the SDK's local Analytics data. Crash/diagnostic reporting remains on.
- Operational diagnostics use a random installation identifier and a bounded
  technical breadcrumb window around failures. Request bodies, authentication
  tokens, passwords, message contents, and user media are excluded.

## Apple App Privacy and privacy manifest

Declare the following as collected and linked to the user. None are used for
tracking.

| Apple data type | Purpose |
|---|---|
| Name | App Functionality |
| Email Address | App Functionality |
| User ID | App Functionality |
| Coarse Location | App Functionality |
| Photos or Videos | App Functionality |
| Audio Data | App Functionality |
| Customer Support | App Functionality |
| Other User Content | App Functionality |
| Purchase History | App Functionality |
| Device ID | App Functionality; Analytics when usage analytics is enabled |
| Product Interaction | App Functionality; Analytics when usage analytics is enabled |
| Other Usage Data | App Functionality; Product Personalization; Analytics when enabled |
| Crash Data | App Functionality; Analytics |
| Performance Data | App Functionality; Analytics |
| Other Diagnostic Data | App Functionality; Analytics |
| Other Data Types | App Functionality for attestation/security and technical records not covered above |

Do not declare payment-card details: Apple and Google process them and MyTurn
does not receive the full card number. Do not declare precise location unless
release traffic shows coordinates leaving the device; the intended flow sends
only an editable city/country label. The signed archive's generated privacy
report must be compared with this table because embedded SDK manifests can add
entries.

## Google Play Data Safety

Use the following source-based map. “Required” means the type is collected by
at least one core flow even if a separate analytics use of the same type is
optional.

| Play category / data type | Required or optional | Purposes |
|---|---|---|
| Location / Approximate location | Optional, user can omit/edit the post label | App functionality |
| Personal info / Name | Required for account/profile | App functionality; Account management |
| Personal info / Email address | Required for email accounts; provider-dependent for social sign-in | App functionality; Account management; Developer communications |
| Personal info / User IDs | Required | App functionality; Account management; Fraud prevention/security |
| Financial info / Purchase history | Optional, only when paid features are used | App functionality; Account management |
| Photos and videos / Photos | Optional, user-created content | App functionality |
| Photos and videos / Videos | Optional, user-created content | App functionality |
| Audio files / Voice or sound recordings | Optional, audio within user-created videos | App functionality |
| App activity / App interactions | Required for social/feed state; additional Analytics use is opt-in | App functionality; Personalization; Analytics when enabled |
| App activity / Other user-generated content | Optional, including captions, comments, reactions, support and feedback content | App functionality |
| App info and performance / Crash logs | Required while Crashlytics remains enabled | Analytics |
| App info and performance / Diagnostics | Required while Crashlytics and operational diagnostics remain enabled | Analytics; Fraud prevention/security |
| App info and performance / Other app performance data | Required while performance diagnostics remain enabled | Analytics |
| Device or other IDs / Device or other IDs | Required for security, push, sessions and purchases; additional Analytics use is opt-in | App functionality; Fraud prevention/security; Analytics when enabled |

Before submission, verify whether friend-search terms or any other search
queries are retained in application, proxy, or provider logs. If they are,
also declare **App activity / In-app search history** with the applicable
purposes. Confirm whether support/feedback content is better represented as
“Other user-generated content” or another Play Console subtype shown by the
current form.

## Release verification that remains required

1. Build the production-signed iOS archive and Android AAB from a clean checkout.
2. Generate and inspect Xcode's privacy report, including every embedded SDK.
3. Install store-distributed test builds on physical iOS and Android devices.
4. Capture traffic once with usage analytics off and once after explicit opt-in.
5. With analytics off, confirm no Firebase Analytics event upload occurs before
   JavaScript starts, at login, during navigation, or after relaunch.
6. Confirm Crashlytics, FCM, App Check, RevenueCat, media storage, email, and API
   endpoints and the fields they receive.
7. Verify no advertising identifier is collected and no HTTP production request
   is permitted.
8. Reconcile the capture, Firebase/RevenueCat retention settings, SDK disclosures,
   privacy policy, Apple questionnaire, Google form, and this document.

## Authoritative form guidance

- Apple: https://developer.apple.com/documentation/technotes/tn3184-adding-data-collection-details-to-your-privacy-manifest
- Google Play: https://support.google.com/googleplay/android-developer/answer/10787469
- Firebase Analytics collection controls: https://firebase.google.com/docs/analytics/configure-data-collection
