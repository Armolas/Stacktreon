;; title: stacktreon
;; version: 1.0.2
;; summary: Subscription platform with auto-renewal and grace period
;; description: Creators can register subscription fees, fans can subscribe with auto-renewal option and grace period for failed payments

(define-constant THIRTY_DAYS u2592000) ;; 30 days * 24 hours * 60 minutes * 60 seconds = 2,592,000 seconds
(define-constant GRACE_PERIOD u259200) ;; 3 days grace period for failed auto-renewals (2,592,000 / 10 = 259,200 seconds)
(define-constant MAX_RETRY_ATTEMPTS u3) ;; Maximum number of retry attempts

;; Enhanced creator map
(define-map creators principal { 
  fee: uint, 
  totalEarning: uint, 
  balance: uint,
  autoRenewalDefault: bool,  ;; Default auto-renewal setting for new subscribers
  totalSubscribers: uint      ;; Total active subscribers count
})

;; Enhanced subscriber map
(define-map subscribers  
  {creator: principal, fan: principal} 
  {
    subscribed: bool,
    dateStarted: uint,
    dateEnded: uint,
    autoRenew: bool,           ;; Auto-renewal preference
    paymentAttempts: uint,      ;; Failed payment attempts
    gracePeriodEnd: uint,       ;; End of grace period for failed payments
    lastPaymentTime: uint       ;; Last successful payment timestamp
  }
)

;; New map for tracking payment history
(define-map paymentHistory
  { paymentId: uint }
  {
    creator: principal,
    fan: principal,
    amount: uint,
    timestamp: uint,
    status: (string-ascii 20)  ;; "success", "failed", "refunded"
  }
)

;; New error codes
(define-constant ERR_AUTO_RENEW_FAILED (err u5))
(define-constant ERR_IN_GRACE_PERIOD (err u6))
(define-constant ERR_MAX_RETRIES (err u7))
(define-constant ERR_INSUFFICIENT_BALANCE (err u8))

(define-data-var next-payment-id uint u0)
(define-data-var total-auto-renewals uint u0)

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

(define-read-only (is-active-subscriber (creator principal) (fan principal))
  (let
    (
      (subscriber (default-to { 
        subscribed: false, 
        dateStarted: u0, 
        dateEnded: u0,
        autoRenew: false,
        paymentAttempts: u0,
        gracePeriodEnd: u0,
        lastPaymentTime: u0
      } (map-get? subscribers {creator: creator, fan: fan})))
      (dateEnded (get dateEnded subscriber))
      (graceEnd (get gracePeriodEnd subscriber))
      (current-time stacks-block-time)
    )
    ;; Active if:
    ;; 1. Subscription is active and not expired, OR
    ;; 2. Within grace period after expiration
    (ok (or 
      (and (get subscribed subscriber) (> dateEnded current-time))
      (and (get subscribed subscriber) (> graceEnd current-time) (< dateEnded current-time))
    ))
  )
)

(define-read-only (get-creator (who principal))
  (default-to { 
    fee: u0, 
    totalEarning: u0, 
    balance: u0,
    autoRenewalDefault: false,
    totalSubscribers: u0
  } (map-get? creators who))
)

(define-read-only (get-subscriber-info (creator principal) (fan principal))
  (map-get? subscribers {creator: creator, fan: fan})
)

(define-read-only (get-payment-history (paymentId uint))
  (map-get? paymentHistory { paymentId: paymentId })
)

(define-read-only (can-auto-renew (creator principal) (fan principal))
  (let
    (
      (subscriber (unwrap! (map-get? subscribers {creator: creator, fan: fan}) (err u1)))
      (current-time stacks-block-time)
    )
    (ok (and 
      (get autoRenew subscriber)
      (get subscribed subscriber)
      (<= (get dateEnded subscriber) current-time)
      (< (get paymentAttempts subscriber) MAX_RETRY_ATTEMPTS)
    ))
  )
)

;; ============================================
;; PUBLIC FUNCTIONS
;; ============================================

(define-public (register-creator (who principal) (subscription-fee uint))
  (let
    (
      (creator (default-to { 
        fee: u0, 
        totalEarning: u0, 
        balance: u0,
        autoRenewalDefault: false,
        totalSubscribers: u0
      } (map-get? creators who)))
      (fee (get fee creator))
    )   
    (asserts! (> subscription-fee u0) (err u3))
    (asserts! (<= fee u0) (err u4))

    (map-set creators who {
      fee: subscription-fee,
      totalEarning: u0,
      balance: u0,
      autoRenewalDefault: false,
      totalSubscribers: u0
    })
    (ok true)
  )
)

;; ENHANCED: Subscribe with auto-renewal option
(define-public (subscribe (who principal) (autoRenewEnabled bool))
  (let
    (
      (creator (unwrap! (map-get? creators who) (err u1)))
      (fee (get fee creator))
      (totalEarning (get totalEarning creator))
      (balance (get balance creator))
      (totalSubscribers (get totalSubscribers creator))
      (subscriber (default-to { 
        subscribed: false, 
        dateStarted: u0, 
        dateEnded: u0,
        autoRenew: false,
        paymentAttempts: u0,
        gracePeriodEnd: u0,
        lastPaymentTime: u0
      } (map-get? subscribers {creator: who, fan: tx-sender})))
      (dateEnded (get dateEnded subscriber))
      (current-time stacks-block-time)
      (paymentId (var-get next-payment-id))
    )
    ;; Check if existing subscription has expired or within grace period
    (asserts! (or 
      (not (get subscribed subscriber))
      (<= dateEnded current-time)
    ) (err u2))
    
    ;; Transfer payment
    (try! (stx-transfer? fee tx-sender current-contract))
    
    ;; Update creator stats
    (map-set creators who {
      fee: fee,
      totalEarning: (+ totalEarning fee),
      balance: (+ balance fee),
      autoRenewalDefault: (get autoRenewalDefault creator),
      totalSubscribers: (+ totalSubscribers u1)
    })
    
    ;; Update subscriber info
    (map-set subscribers {creator: who, fan: tx-sender} {
      subscribed: true,
      dateStarted: current-time,
      dateEnded: (+ current-time THIRTY_DAYS),
      autoRenew: autoRenewEnabled,
      paymentAttempts: u0,
      gracePeriodEnd: u0,
      lastPaymentTime: current-time
    })
    
    ;; Record payment
    (map-set paymentHistory { paymentId: paymentId } {
      creator: who,
      fan: tx-sender,
      amount: fee,
      timestamp: current-time,
      status: "success"
    })
    
    (var-set next-payment-id (+ paymentId u1))
    (if autoRenewEnabled
      (var-set total-auto-renewals (+ (var-get total-auto-renewals) u1))
      false
    )
    
    (ok paymentId)
  )
)

;; NEW: Auto-renewal execution
(define-public (process-auto-renewal (creator principal) (fan principal))
  (let
    (
      (creatorData (unwrap! (map-get? creators creator) (err u1)))
      (subscriber (unwrap! (map-get? subscribers {creator: creator, fan: fan}) (err u1)))
      (fee (get fee creatorData))
      (current-time stacks-block-time)
      (paymentId (var-get next-payment-id))
    )
    ;; Validate auto-renewal is possible
    (asserts! (get autoRenew subscriber) (err u5))
    (asserts! (get subscribed subscriber) (err u5))
    (asserts! (>= current-time (get dateEnded subscriber)) (err u5))
    (asserts! (< (get paymentAttempts subscriber) MAX_RETRY_ATTEMPTS) (err u7))
    
    ;; Try to process payment
    (match (stx-transfer? fee fan current-contract)
      ;; Payment successful
      (success
        (begin
          ;; Update subscriber
          (map-set subscribers {creator: creator, fan: fan} {
            subscribed: true,
            dateStarted: (get dateStarted subscriber),
            dateEnded: (+ current-time THIRTY_DAYS),
            autoRenew: (get autoRenew subscriber),
            paymentAttempts: u0,
            gracePeriodEnd: u0,
            lastPaymentTime: current-time
          })
          
          ;; Update creator stats
          (map-set creators creator {
            fee: fee,
            totalEarning: (+ (get totalEarning creatorData) fee),
            balance: (+ (get balance creatorData) fee),
            autoRenewalDefault: (get autoRenewalDefault creatorData),
            totalSubscribers: (get totalSubscribers creatorData)
          })
          
          ;; Record successful payment
          (map-set paymentHistory { paymentId: paymentId } {
            creator: creator,
            fan: fan,
            amount: fee,
            timestamp: current-time,
            status: "success"
          })
          
          (var-set next-payment-id (+ paymentId u1))
          (ok paymentId)
        )
      )
      ;; Payment failed - enter grace period
      (error (err u8))
        (let
          (
            (newAttempts (+ (get paymentAttempts subscriber) u1))
          )
          (map-set subscribers {creator: creator, fan: fan} {
            subscribed: true,
            dateStarted: (get dateStarted subscriber),
            dateEnded: (get dateEnded subscriber),
            autoRenew: (get autoRenew subscriber),
            paymentAttempts: newAttempts,
            gracePeriodEnd: (+ current-time GRACE_PERIOD),
            lastPaymentTime: (get lastPaymentTime subscriber)
          })
          
          ;; Record failed payment
          (map-set paymentHistory { paymentId: paymentId } {
            creator: creator,
            fan: fan,
            amount: fee,
            timestamp: current-time,
            status: "failed"
          })
          
          (var-set next-payment-id (+ paymentId u1))
          (err ERR_AUTO_RENEW_FAILED)
        )
      )
    )
  )
)

;; NEW: Cancel auto-renewal
(define-public (cancel-auto-renewal (creator principal))
  (let
    (
      (subscriber (unwrap! (map-get? subscribers {creator: creator, fan: tx-sender}) (err u1)))
    )
    (asserts! (get autoRenew subscriber) (err u5))
    
    (map-set subscribers {creator: creator, fan: tx-sender} {
      subscribed: (get subscribed subscriber),
      dateStarted: (get dateStarted subscriber),
      dateEnded: (get dateEnded subscriber),
      autoRenew: false,
      paymentAttempts: (get paymentAttempts subscriber),
      gracePeriodEnd: (get gracePeriodEnd subscriber),
      lastPaymentTime: (get lastPaymentTime subscriber)
    })
    
    (var-set total-auto-renewals (- (var-get total-auto-renewals) u1))
    (ok true)
  )
)

;; NEW: Set default auto-renewal preference for creator
(define-public (set-auto-renewal-default (enabled bool))
  (let
    (
      (creator (unwrap! (map-get? creators tx-sender) (err u1)))
    )
    (map-set creators tx-sender {
      fee: (get fee creator),
      totalEarning: (get totalEarning creator),
      balance: (get balance creator),
      autoRenewalDefault: enabled,
      totalSubscribers: (get totalSubscribers creator)
    })
    (ok true)
  )
)

;; Enhanced withdraw function
(define-public (withdraw-creator-earning (amount uint))
  (let
    (
      (creator (unwrap! (map-get? creators tx-sender) (err u1)))
      (balance (get balance creator))
      (fee (get fee creator))
      (totalEarning (get totalEarning creator))
      (autoRenewDefault (get autoRenewalDefault creator))
      (totalSubscribers (get totalSubscribers creator))
    )
    (asserts! (>= balance amount) (err u4))
    
    (map-set creators tx-sender {
      fee: fee,
      totalEarning: totalEarning,
      balance: (- balance amount),
      autoRenewalDefault: autoRenewDefault,
      totalSubscribers: totalSubscribers
    })
    
    (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))
    (ok true)
  )
)

(define-public (update-subscription-fee (new-fee uint))
  (let
    (
      (creator (unwrap! (map-get? creators tx-sender) (err u1)))
      (balance (get balance creator))
      (totalEarning (get totalEarning creator))
      (autoRenewDefault (get autoRenewalDefault creator))
      (totalSubscribers (get totalSubscribers creator))
    )
    (asserts! (> new-fee u0) (err u4))
    
    (map-set creators tx-sender {
      fee: new-fee,
      totalEarning: totalEarning,
      balance: balance,
      autoRenewalDefault: autoRenewDefault,
      totalSubscribers: totalSubscribers
    })
    (ok true)
  )
)

;; NEW: Get subscription status with grace period info
(define-read-only (get-subscription-status (creator principal) (fan principal))
  (let
    (
      (subscriber (map-get? subscribers {creator: creator, fan: fan}))
    )
    (match subscriber
      data 
        (let
          (
            (current-time stacks-block-time)
            (dateEnded (get dateEnded data))
            (graceEnd (get gracePeriodEnd data))
          )
          (ok {
            isActive: (or (> dateEnded current-time) (> graceEnd current-time)),
            isExpired: (and (<= dateEnded current-time) (<= graceEnd current-time)),
            inGracePeriod: (and (<= dateEnded current-time) (> graceEnd current-time)),
            autoRenew: (get autoRenew data),
            daysRemaining: (/ (- dateEnded current-time) u86400),
            paymentAttempts: (get paymentAttempts data)
          })
        )
      (ok none)
    )
  )
)
