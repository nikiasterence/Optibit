/* ======================================
   OPTIBIT - Particle Background
   Animated floating particles with connections
   ====================================== */

(function() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;
    let mouseX = 0;
    let mouseY = 0;

    const config = {
        particleCount: 60,
        maxSpeed: 0.3,
        minSize: 1,
        maxSize: 2.5,
        connectionDistance: 150,
        mouseRadius: 200,
        colors: ['#00d4ff', '#7c3aed', '#ec4899', '#ffffff']
    };

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createParticle() {
        const color = config.colors[Math.floor(Math.random() * config.colors.length)];
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * config.maxSpeed,
            vy: (Math.random() - 0.5) * config.maxSpeed,
            size: Math.random() * (config.maxSize - config.minSize) + config.minSize,
            color: color,
            opacity: Math.random() * 0.5 + 0.1
        };
    }

    function init() {
        resize();
        particles = [];
        const count = Math.min(config.particleCount, Math.floor((canvas.width * canvas.height) / 20000));
        for (let i = 0; i < count; i++) {
            particles.push(createParticle());
        }
    }

    function drawParticle(p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawConnection(p1, p2, distance) {
        const opacity = (1 - distance / config.connectionDistance) * 0.15;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    function update() {
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Bounce off edges
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            // Keep in bounds
            p.x = Math.max(0, Math.min(canvas.width, p.x));
            p.y = Math.max(0, Math.min(canvas.height, p.y));

            // Mouse interaction
            const dx = mouseX - p.x;
            const dy = mouseY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < config.mouseRadius) {
                const force = (config.mouseRadius - dist) / config.mouseRadius * 0.02;
                p.vx -= dx * force;
                p.vy -= dy * force;
            }

            // Speed limit
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > config.maxSpeed * 2) {
                p.vx = (p.vx / speed) * config.maxSpeed;
                p.vy = (p.vy / speed) * config.maxSpeed;
            }
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < config.connectionDistance) {
                    drawConnection(particles[i], particles[j], dist);
                }
            }
        }

        // Draw particles
        particles.forEach(drawParticle);
    }

    function animate() {
        update();
        draw();
        animationId = requestAnimationFrame(animate);
    }

    // Event listeners
    window.addEventListener('resize', () => {
        resize();
        // Readjust particle positions
        particles.forEach(p => {
            if (p.x > canvas.width) p.x = canvas.width;
            if (p.y > canvas.height) p.y = canvas.height;
        });
    });

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Reduce particles on mobile
    if (window.innerWidth < 768) {
        config.particleCount = 25;
        config.connectionDistance = 100;
    }

    // Initialize and start
    init();
    animate();

    // Pause when tab is not visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(animationId);
        } else {
            animate();
        }
    });
})();
