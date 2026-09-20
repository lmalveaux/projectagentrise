# Medicare Mobile App Companion: Card Decrypter & Compliance Consent Template

This guide is designed as an on-the-go reference for independent agents. Use the structured layouts below directly inside your mobile app to help agents decrypt client Medicare cards compliantly and execute Scope of Appointment (SOA) consent forms in the field.

---

## Part 1: Simulated Medicare Card Decrypter

Below is the standard layout of the Red, White, and Blue Medicare Card. Use this interactive visual text decoder to help new agents quickly find the exact data points they need to verify eligibility and submit applications.

```text
┌────────────────────────────────────────────────────────┐
│  MEDICARE      HEALTH INSURANCE                        │
│                                                        │
│  Name/Nombre                                           │
│     JOHN L. SMITH                                      │
│                                                        │
│  Medicare Number/Número de Medicare                    │
│     1EG4-TE5-MK72                                      │
│                                                        │
│  Entitled to/Con derecho a      Coverage Starts/Comienzo│
│     HOSPITAL  (PART A)          09-01-2026             │
│     MEDICAL   (PART B)          09-01-2026             │
└────────────────────────────────────────────────────────┘
```

### 🔍 Field Decoder for Mobile App Integration

#### 1. The Medicare Number (MBI - Medicare Beneficiary Identifier)
*   **The Number**: `1EG4-TE5-MK72`
*   **What It Means**: This is a unique, randomly generated 11-character alphanumeric identifier. It contains only numbers and uppercase letters (specifically excluding letters like "S", "L", "O", "I", "B", and "Z" to avoid visual confusion with digits) [2]. 
*   **Insider Note**: This number completely replaced the old Social Security-based claim numbers to protect beneficiary identities and prevent fraud. It is highly confidential and must never be shared with anyone other than the client's authorized medical providers or licensed agents during enrollment.

#### 2. Entitled To (Parts A & B)
*   **Hospital (Part A)**: Covers inpatient hospital care, skilled nursing, and hospice [105]. Most clients receive this premium-free if they or their spouse earned 40 Social Security work credits (approximately 10 years of work) [106].
*   **Medical (Part B)**: Covers outpatient services and doctor visits [108]. Everyone pays a monthly premium for Part B (the 2026 standard premium is **$202.90**) [10]. 

#### 3. Coverage Start Dates
*   **Why It Matters**: These dates are crucial for verifying eligibility during Enrollment Periods. If a client is turning 65, their coverage start date marks the anchor for their Initial Enrollment Period (IEP) [103]. 

---

## Part 2: 2026 Scope of Appointment (SOA) & Consent Form

CMS regulations strictly require that a client sign a **Scope of Appointment (SOA)** form prior to any Medicare Advantage (Part C) or Prescription Drug Plan (Part D) sales presentation [110]. This ensures the client consents to discuss specific products and prevents unauthorized cross-selling.

### 📋 Scope of Appointment Template (Mobile Application Layout)

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                    SCOPE OF APPOINTMENT (SOA) CONSENT FORM                │
├───────────────────────────────────────────────────────────────────────────┤
│ BENEFICIARY CONTACT INFORMATION                                           │
│ Name: ____________________________________   Phone: _____________________ │
│ Address: ________________─────────────────   Date of Birth: _____________ │
├───────────────────────────────────────────────────────────────────────────┤
│ PRODUCT SELECTION CONSENT                                                 │
│ The beneficiary must initial next to each product type they agree to      │
│ discuss with the agent during this appointment:                           │
│                                                                           │
│ [   ] Medicare Advantage Plans (Part C): Includes HMOs, PPOs, and private │
│       fee-for-service plans that cover medical and hospital services.     │
│                                                                           │
│ [   ] Medicare Prescription Drug Plans (Part D): Standalone coverage      │
│       for take-home prescription medications.                             │
├───────────────────────────────────────────────────────────────────────────┤
│ BENEFICIARY ACKNOWLEDGMENT & SIGNATURE                                    │
│ By signing below, you agree to a meeting with a licensed agent to discuss │
│ the product types initialed above. This does not obligate you to enroll   │
│ in a plan, and your current benefits will not be affected.                │
│                                                                           │
│ Beneficiary Signature: _________________________________ Date: __________ │
├───────────────────────────────────────────────────────────────────────────┤
│ AGENT RELATIONSHIP DISCLOSURE (MUST BE COMPLETED BY WRITING AGENT)        │
│ Agent Name: ____________________________  Agent NPN: ____________________ │
│ Plan Year Discussed: 2026/2027            Date of Appointment: __________ │
│                                                                           │
│ Agent Signature: ________________─────────────────────── Date: __________ │
└───────────────────────────────────────────────────────────────────────────┘
```

### ⚡ Critical Compliance Notes for the Mobile App:

*   **The 48-Hour Rule**: The SOA must be completed and signed at least **48 hours prior** to the scheduled appointment, unless the client is within the final days of an enrollment period or has walked into an agent's physical office as an unscheduled "walk-in."
*   **Product Boundaries**: The agent is legally prohibited from discussing any products that the client did not initial. For example, if the client did not initial Part D, the agent cannot discuss drug copays or formularies during that session [110]. 
*   **Record Retention**: Under CMS guidelines, independent solopreneurs must retain signed SOAs and enrollment consent documentation for a minimum of **10 years**. The app should automatically archive completed digital forms to secure cloud storage.
