
    // Solution Pricing Table JavaScript
    (function () {
        'use strict';

        // Solution DOM Elements
        const solutionElements = {
            paymentTabs: document.querySelectorAll('.solution-payment-tab'),
            paymentOptions: document.querySelectorAll('.solution-payment-option'),
            pricingCard: document.querySelector('.solution-pricing-card'),
            paymentTabSlider: document.querySelector('.solution-payment-tab-slider')
        };

        // Solution Configuration
        const solutionConfig = {
            activePaymentTabClass: 'solution-payment-tab--active',
            activeOptionClass: 'solution-payment-option--active'
        };

        // Solution Tab Manager
        const SolutionTabManager = {
            // Initialize the tab functionality
            init() {
                this.attachEventListeners();
                this.setupInitialState();
            },

            // Attach click event listeners to tabs
            attachEventListeners() {
                solutionElements.paymentTabs.forEach(tab => {
                    tab.addEventListener('click', (e) => this.handlePaymentTabClick(e));
                });
            },

            // Setup initial state
            setupInitialState() {
                // Ensure split payment tab is active (first tab)
                const splitPaymentTab = solutionElements.paymentTabs[0];

                if (splitPaymentTab && !splitPaymentTab.classList.contains(solutionConfig.activePaymentTabClass)) {
                    splitPaymentTab.classList.add(solutionConfig.activePaymentTabClass);
                }

                // Remove active class from second tab if it exists
                const secondPaymentTab = solutionElements.paymentTabs[1];
                if (secondPaymentTab && secondPaymentTab.classList.contains(solutionConfig.activePaymentTabClass)) {
                    secondPaymentTab.classList.remove(solutionConfig.activePaymentTabClass);
                }

                // Position slider on initial load
                if (splitPaymentTab) {
                    this.moveSlider(splitPaymentTab, solutionElements.paymentTabSlider);
                }

                // Ensure initial payment options for all packages are set to "split"
                solutionElements.paymentOptions.forEach(option => {
                    const paymentType = option.getAttribute('data-payment');
                    if (paymentType === 'split') {
                        option.classList.add(solutionConfig.activeOptionClass);
                    } else {
                        option.classList.remove(solutionConfig.activeOptionClass);
                    }
                });
            },

            // Handle payment tab click events
            handlePaymentTabClick(event) {
                const clickedTab = event.currentTarget;
                const paymentType = clickedTab.getAttribute('data-payment-type');

                // If already active, do nothing
                if (clickedTab.classList.contains(solutionConfig.activePaymentTabClass)) {
                    return;
                }

                // Update payment tabs
                this.updatePaymentTabs(clickedTab);

                // Update payment options for all packages
                this.updatePaymentOptions(paymentType);
            },

            // Update payment tab states
            updatePaymentTabs(activeTab) {
                solutionElements.paymentTabs.forEach(tab => {
                    tab.classList.remove(solutionConfig.activePaymentTabClass);
                    tab.setAttribute('aria-selected', 'false');
                });

                activeTab.classList.add(solutionConfig.activePaymentTabClass);
                activeTab.setAttribute('aria-selected', 'true');

                // Move the slider
                this.moveSlider(activeTab, solutionElements.paymentTabSlider);
            },

            // Move slider to active tab
            moveSlider(activeTab, slider) {
                if (slider) {
                    const tabIndex = Array.from(activeTab.parentElement.children).indexOf(activeTab);
                    // Move slider to correct position (accounting for 50% width + 6px gap)
                    const translateX = tabIndex === 0 ? 0 : 'calc(100% + 6px)';
                    slider.style.transform = `translateX(${translateX})`;
                }
            },

            // Update payment option visibility for all packages
            updatePaymentOptions(paymentType) {
                solutionElements.paymentOptions.forEach(option => {
                    const optionType = option.getAttribute('data-payment');

                    if (optionType === paymentType) {
                        option.classList.add(solutionConfig.activeOptionClass);
                    } else {
                        option.classList.remove(solutionConfig.activeOptionClass);
                    }
                });
            }
        };

        // Solution Analytics (optional - tracks which payment option users click)
        const SolutionAnalytics = {
            init() {
                this.trackButtonClicks();
            },

            trackButtonClicks() {
                const buttons = document.querySelectorAll('.solution-select-btn');

                buttons.forEach(button => {
                    button.addEventListener('click', (e) => {
                        const paymentOption = button.closest('.solution-payment-option');
                        const pricingContent = button.closest('.solution-pricing-content');
                        const paymentType = paymentOption ? paymentOption.getAttribute('data-payment') : 'unknown';
                        const packageTitle = pricingContent ? pricingContent.querySelector('.solution-title').textContent : 'unknown';

                        // Log the selection (you can replace this with your analytics implementation)
                        console.log(`Solution Pricing: User selected ${packageTitle} with ${paymentType} payment option`);

                        // Optional: Add loading state
                        this.addLoadingState(button);
                    });
                });
            },

            addLoadingState(button) {
                // No loading animation
            }
        };

        // Solution Accessibility Enhancements
        const SolutionAccessibility = {
            init() {
                this.setupKeyboardNavigation();
                this.addAriaLabels();
            },

            setupKeyboardNavigation() {
                solutionElements.paymentTabs.forEach((tab, index) => {
                    tab.addEventListener('keydown', (e) => {
                        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                            e.preventDefault();
                            const nextIndex = e.key === 'ArrowRight'
                                ? (index + 1) % solutionElements.paymentTabs.length
                                : (index - 1 + solutionElements.paymentTabs.length) % solutionElements.paymentTabs.length;

                            solutionElements.paymentTabs[nextIndex].focus();
                            solutionElements.paymentTabs[nextIndex].click();
                        }
                    });
                });
            },

            addAriaLabels() {
                // Add ARIA labels for better screen reader support
                const pricingCard = document.querySelector('.solution-pricing-card');
                if (pricingCard) {
                    pricingCard.setAttribute('role', 'region');
                    pricingCard.setAttribute('aria-label', 'Solution Pricing Options');
                }

                // Add role to tab container
                const paymentTabContainer = document.querySelector('.solution-payment-tabs');
                if (paymentTabContainer) {
                    paymentTabContainer.setAttribute('role', 'tablist');
                }

                // Add roles to individual tabs
                solutionElements.paymentTabs.forEach((tab, index) => {
                    tab.setAttribute('role', 'tab');
                    tab.setAttribute('tabindex', index === 0 ? '0' : '-1'); // Split payment tab (index 0) gets focus
                    tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false'); // Split payment tab is selected
                });
            }
        };

        // Solution Utility Functions
        const SolutionUtils = {
            // Debounce function for performance
            debounce(func, wait) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            },

            // Check if element is in viewport
            isInViewport(element) {
                const rect = element.getBoundingClientRect();
                return (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                );
            }
        };

        // Initialize everything when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize all solution modules
            SolutionTabManager.init();
            SolutionAnalytics.init();
            SolutionAccessibility.init();
        });

        // Export for potential use in other scripts
        window.SolutionPricing = {
            TabManager: SolutionTabManager,
            Analytics: SolutionAnalytics,
            Accessibility: SolutionAccessibility,
            Utils: SolutionUtils
        };

    })();
