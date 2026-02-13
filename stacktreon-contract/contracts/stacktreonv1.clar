;; title: stacktreon
;; version: 1.0.1
;; summary:
;; description:


(define-constant THIRTY_DAYS u2592000) ;; 30 days * 24 hours * 60 minutes * 60 seconds = 2,592,000 seconds

(define-map creators principal { fee: uint, totalEarning: uint, balance: uint })
(define-map subscribers  {creator: principal, fan: principal} {subscribed: bool, dateStarted: uint, dateEnded: uint})




(define-public (register-creator (who principal) (subscription-fee uint))
    (let
    (
        (creator (default-to {fee: u0, totalEarning: u0, balance: u0} (map-get? creators who)))
        (fee (get fee creator))
    )   
        (asserts! (> subscription-fee u0) (err u3))
        (asserts! (<= fee u0) (err u4))

        (map-set creators who {
            fee: subscription-fee,
            totalEarning: u0,
            balance: u0
        })
        (ok true)
    )
)

(define-public (subscribe (who principal))
    (let
    (
        (creator (unwrap! (map-get? creators who) (err u1)))
        (fee (get fee creator))
        (totalEarning (get totalEarning creator))
        (balance (get balance creator))
        (subscriber (default-to {subscribed: false, dateStarted: u0, dateEnded: u0} (map-get? subscribers {creator: who, fan: tx-sender})))
        (dateEnded (get dateEnded subscriber))
    )
        (asserts! (<= dateEnded stacks-block-time) (err u2))
        (try! (stx-transfer? fee tx-sender current-contract))
        (map-set creators who {
            fee: fee,
            totalEarning: (+ totalEarning fee),
            balance: (+ balance fee)
        })
        (map-set subscribers {creator: who, fan: tx-sender} {
            subscribed: true,
            dateStarted: stacks-block-time,
            dateEnded: (+ stacks-block-time THIRTY_DAYS)
        })
        (ok true)
    )
)

(define-public (withdraw-creator-earning (amount uint))
    (let
    (
        (creator (unwrap! (map-get? creators tx-sender) (err u1)))
        (balance (get balance creator))
        (fee (get fee creator))
        (totalEarning (get totalEarning creator))
        (who tx-sender)
    )
        (asserts! (>= balance amount) (err u4))
        (map-set creators tx-sender {
            fee: fee,
            totalEarning: totalEarning,
            balance: (- balance amount)
        })
        (as-contract? ((with-stx amount)) (try! (stx-transfer? amount tx-sender who)))
    )
)

(define-public (update-subscription-fee (new-fee uint))
    (let
    (
        (creator (unwrap! (map-get? creators tx-sender) (err u1)))
        (balance (get balance creator))
        (fee (get fee creator))
        (totalEarning (get totalEarning creator))
    )
        (asserts! (> new-fee u0) (err u4))
        (map-set creators tx-sender {
            fee: new-fee,
            totalEarning: totalEarning,
            balance: balance
        })
        (ok true)
    )
)

(define-read-only (is-active-subscriber (creator principal) (fan principal))
    (let
    (
        (subscriber (default-to {subscribed: false, dateStarted: u0, dateEnded: u0} (map-get? subscribers {creator: creator, fan: fan})))
        (dateEnded (get dateEnded subscriber))
    )
        (if (> dateEnded stacks-block-time) 
        (ok true) 
        (ok false)
        )
    )
)

(define-read-only (get-creator (who principal))
    (default-to {fee: u0, totalEarning: u0, balance: u0} (map-get? creators who))
)