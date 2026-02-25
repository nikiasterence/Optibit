/* ======================================
   OPTIBIT - Main JavaScript
   Interactions, Animations, PWA
   ====================================== */

document.addEventListener('DOMContentLoaded', () => {
    try {
        const hasProfile = !!localStorage.getItem('optibit_user');
        const onLanding = window.location.pathname.endsWith('/index.html') || window.location.pathname === '/' || window.location.pathname === '';
        if (hasProfile && onLanding) {
            window.location.replace('app.html');
            return;
        }
    } catch (e) {
        console.warn('Auto-redirect check failed:', e);
    }

    // ---- Loader ----
    const loader = document.getElementById('loader');
    window.addEventListener('load', () => {
        setTimeout(() => {
            loader.classList.add('hidden');
            document.body.style.overflow = '';
        }, 1800);
    });
    // Fallback loader removal
    setTimeout(() => {
        if (loader && !loader.classList.contains('hidden')) {
            loader.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }, 4000);

    // ---- Navbar Scroll Effect ----
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 60) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScroll = currentScroll;
    });

    // ---- Mobile Navigation ----
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close mobile nav on link click
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Close mobile nav on outside click
    document.addEventListener('click', (e) => {
        if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });

    // ---- Scroll Animations ----
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.getAttribute('data-delay') || 0;
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, parseInt(delay));
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // ---- Counter Animation ----
    function animateCounter(el) {
        const target = parseInt(el.getAttribute('data-count'));
        const duration = 2000;
        const startTime = performance.now();
        
        function updateCount(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * target);
            el.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(updateCount);
            }
        }
        
        requestAnimationFrame(updateCount);
    }

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counters = entry.target.querySelectorAll('.stat-number[data-count]');
                counters.forEach(counter => animateCounter(counter));
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        counterObserver.observe(statsSection);
    }

    // ---- Smooth Scroll for Anchor Links ----
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const offset = 80;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ---- Active Nav Link Highlight ----
    const sections = document.querySelectorAll('section[id]');
    
    function updateActiveNav() {
        const scrollY = window.pageYOffset;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 150;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', updateActiveNav);

    // ---- Chat Demo Interaction ----
    const chatItems = document.querySelectorAll('.demo-chat-item[data-chat]');
    chatItems.forEach(item => {
        item.addEventListener('click', () => {
            item.style.background = 'rgba(0,212,255,0.05)';
            setTimeout(() => {
                item.style.background = '';
            }, 300);
        });
    });

    // ---- Typing Animation in Mock Chat ----
    function simulateTyping() {
        const typingBubble = document.querySelector('.mock-bubble.typing');
        if (!typingBubble) return;

        setInterval(() => {
            typingBubble.style.opacity = '1';
            setTimeout(() => {
                typingBubble.style.opacity = '0';
            }, 3000);
        }, 5000);
    }
    simulateTyping();

    // ---- Encrypted Text Animation ----
    function animateEncryptedText() {
        const encryptedCode = document.querySelector('.encrypt-code.encrypted');
        if (!encryptedCode) return;

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        
        setInterval(() => {
            let result = '';
            for (let i = 0; i < 14; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            encryptedCode.textContent = result;
        }, 150);
    }

    const encryptObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateEncryptedText();
                encryptObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const encryptDemo = document.querySelector('.encryption-demo');
    if (encryptDemo) {
        encryptObserver.observe(encryptDemo);
    }

    // ---- Parallax Effect on Hero ----
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const heroContent = document.querySelector('.hero-content');
        const mockup = document.querySelector('.hero-mockup');
        
        if (heroContent && scrolled < window.innerHeight) {
            heroContent.style.transform = `translateY(${scrolled * 0.15}px)`;
            heroContent.style.opacity = 1 - (scrolled / (window.innerHeight * 0.8));
        }
        
        if (mockup && scrolled < window.innerHeight) {
            mockup.style.transform = `translateY(calc(-50% + ${scrolled * 0.08}px))`;
        }
    });

    // ---- PWA Install Prompt ----
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`Install prompt outcome: ${outcome}`);
                    deferredPrompt = null;
                }
            });
        }
    });

    // Fallback install button behavior
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', () => {
            if (!deferredPrompt) {
                // Show install instructions based on platform
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                const isAndroid = /Android/.test(navigator.userAgent);
                
                let message = '';
                if (isIOS) {
                    message = 'To install Optibit:\n\n1. Tap the Share button (↑)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm';
                } else if (isAndroid) {
                    message = 'To install Optibit:\n\n1. Tap the three-dot menu (⋮)\n2. Tap "Add to Home Screen"\n3. Tap "Add" to confirm';
                } else {
                    message = 'To install Optibit:\n\n1. Look for the install icon (⊕) in your browser\'s address bar\n2. Click "Install" to add Optibit to your device\n\nOr use Chrome/Edge for the best PWA experience!';
                }
                
                alert(message);
            }
        });
    }

    // ---- Register Service Worker ----
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => {
                    console.log('Optibit SW registered:', reg.scope);
                })
                .catch(err => {
                    console.log('Optibit SW registration failed:', err);
                });
        });
    }

    // ---- Shield Particle Positioning ----
    const shieldParticles = document.querySelectorAll('.shield-particles span');
    shieldParticles.forEach((span, i) => {
        const angle = (i / shieldParticles.length) * 360;
        const rad = angle * (Math.PI / 180);
        const radius = 110;
        span.style.left = `calc(50% + ${Math.cos(rad) * radius}px)`;
        span.style.top = `calc(50% + ${Math.sin(rad) * radius}px)`;
        span.style.animationDelay = `${i * 0.5}s`;
    });

    // ---- Tilt Effect on Cards ----
    if (window.innerWidth > 768) {
        document.querySelectorAll('.feature-card, .team-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / 20;
                const rotateY = (centerX - x) / 20;
                
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }

    // ---- Console Easter Egg ----
    console.log(
        '%c📡 Optibit %c Bluetooth & WiFi Messenger',
        'background: linear-gradient(135deg, #00d4ff, #7c3aed); color: #0a0a0f; padding: 8px 12px; border-radius: 4px 0 0 4px; font-weight: bold; font-size: 14px;',
        'background: #1a1a2e; color: #00d4ff; padding: 8px 12px; border-radius: 0 4px 4px 0; font-size: 14px;'
    );
    console.log('%cCreated by Cozytustudios | Founded by Sajid Hossain', 'color: #a0a0b8; font-size: 11px;');

});
