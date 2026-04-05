document.addEventListener('DOMContentLoaded', () => {
    const paletteItems = document.querySelectorAll('.service-item');
    const dropzone = document.getElementById('dropzone');
    const emptyState = document.querySelector('.empty-state');
    const totalCostEl = document.getElementById('totalCost');
    const svgLayer = document.getElementById('connections-layer');
    const regionSelect = document.getElementById('regionSelect');

    let totalCost = 0;
    let nodeCounter = 0;
    let regionMultiplier = 1.0;
    
    // Store nodes and connections
    const nodes = {}; // id -> { elem, x, y, price, count }
    const connections = []; // { sourceId, targetId }
    
    let isNodeDragging = false;
    let draggingNodeId = null;
    let startX = 0, startY = 0, initialX = 0, initialY = 0;
    
    let connectingPort = null; // { nodeId, elem }
    let tempLine = null;

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const updateTotal = () => {
        let sum = 0;
        Object.values(nodes).forEach(n => {
            sum += (n.price * n.count * regionMultiplier);
        });
        totalCostEl.textContent = formatMoney(sum);
        
        emptyState.style.opacity = Object.keys(nodes).length > 0 ? '0' : '1';
    };

    // Region Change
    if (regionSelect) {
        regionSelect.addEventListener('change', (e) => {
            const m = {
                'us-east-1': 1.0,
                'us-west-2': 1.0,
                'eu-west-1': 1.1,
                'ap-southeast-1': 1.15
            };
            regionMultiplier = m[e.target.value] || 1.0;
            
            Object.values(nodes).forEach(n => {
                const tag = n.elem.querySelector('.price-tag');
                if (tag) tag.textContent = formatMoney(n.price * regionMultiplier) + '/mo';
            });
            updateTotal();
        });
    }

    // Sidebar dragging to canvas
    paletteItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                id: item.dataset.service,
                name: item.querySelector('span').textContent,
                price: parseFloat(item.dataset.price)
            }));
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        
        const dataStr = e.dataTransfer.getData('application/json');
        if (!dataStr) return;
        
        try {
            const data = JSON.parse(dataStr);
            const rect = dropzone.getBoundingClientRect();
            const x = e.clientX - rect.left - 80;
            const y = e.clientY - rect.top - 20;
            
            createNode(data, x, y);
        } catch (err) { }
    });

    const createNode = (data, x, y) => {
        nodeCounter++;
        const nodeId = 'node_' + nodeCounter;
        
        const node = document.createElement('div');
        node.className = 'node-card';
        node.id = nodeId;
        node.style.left = x + 'px';
        node.style.top = y + 'px';
        
        node.innerHTML = `
            <div class="port left" data-port="left"></div>
            <div class="service-icon ${data.id}"></div>
            <span>${data.name}</span>
            <div class="instance-input-container">
                <input type="number" class="instance-input" value="1" min="1">
                <span class="instance-label">x</span>
            </div>
            <div class="price-tag">${formatMoney(data.price * regionMultiplier)}/mo</div>
            <button class="remove-btn" title="Remove">&times;</button>
            <div class="port right" data-port="right"></div>
        `;

        nodes[nodeId] = { elem: node, x, y, price: data.price, count: 1 };
        
        // Inputs
        const input = node.querySelector('.instance-input');
        input.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) val = 1;
            nodes[nodeId].count = val;
            updateTotal();
        });

        // Removal
        const removeBtn = node.querySelector('.remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            node.remove();
            delete nodes[nodeId];
            for (let i = connections.length - 1; i >= 0; i--) {
                if (connections[i].sourceId === nodeId || connections[i].targetId === nodeId) {
                    connections.splice(i, 1);
                }
            }
            drawConnections();
            updateTotal();
        });

        // Node drag start
        node.addEventListener('mousedown', (e) => {
            if (e.target.closest('.port') || e.target.closest('.instance-input') || e.target.closest('.remove-btn')) return;
            
            isNodeDragging = true;
            draggingNodeId = nodeId;
            node.classList.add('selected');
            startX = e.clientX;
            startY = e.clientY;
            initialX = nodes[nodeId].x;
            initialY = nodes[nodeId].y;
            e.preventDefault(); // Stop text highlight
        });

        // Port drag start
        const ports = node.querySelectorAll('.port');
        ports.forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault(); // Stop text highlight
                connectingPort = { nodeId, elem: port };
            });
        });

        dropzone.appendChild(node);
        updateTotal();
    };

    // Global mouse moves
    document.addEventListener('mousemove', (e) => {
        // Node dragging
        if (isNodeDragging && draggingNodeId) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            nodes[draggingNodeId].x = initialX + dx;
            nodes[draggingNodeId].y = initialY + dy;
            nodes[draggingNodeId].elem.style.left = nodes[draggingNodeId].x + 'px';
            nodes[draggingNodeId].elem.style.top = nodes[draggingNodeId].y + 'px';
            drawConnections();
        }
        
        // Port line drawing
        if (connectingPort) {
            const rect = dropzone.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const portRect = connectingPort.elem.getBoundingClientRect();
            const startX_port = portRect.left + portRect.width/2 - rect.left;
            const startY_port = portRect.top + portRect.height/2 - rect.top;
            
            if (!tempLine) {
                tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                tempLine.setAttribute('class', 'connection-line');
                svgLayer.appendChild(tempLine);
            }
            
            const d = `M ${startX_port} ${startY_port} C ${startX_port + 50} ${startY_port}, ${mouseX - 50} ${mouseY}, ${mouseX} ${mouseY}`;
            tempLine.setAttribute('d', d);
        }
    });

    // Global mouse up
    document.addEventListener('mouseup', (e) => {
        // Finish Node dragging
        if (isNodeDragging) {
            isNodeDragging = false;
            if (draggingNodeId && nodes[draggingNodeId]) {
                nodes[draggingNodeId].elem.classList.remove('selected');
            }
            draggingNodeId = null;
        }
        
        // Finish Port connecting
        if (connectingPort) {
            // Check if dropped on a port
            const targetPort = e.target.closest('.port');
            if (targetPort && targetPort !== connectingPort.elem) {
                const targetNodeId = targetPort.closest('.node-card').id;
                
                // Make sure we aren't connecting a node to itself
                if (targetNodeId !== connectingPort.nodeId) {
                    // Make sure it's not a duplicate connection
                    const exists = connections.some(c => 
                        (c.sourceId === connectingPort.nodeId && c.targetId === targetNodeId) ||
                        (c.sourceId === targetNodeId && c.targetId === connectingPort.nodeId)
                    );
                    
                    if (!exists) {
                        connections.push({
                            sourceId: connectingPort.nodeId,
                            targetId: targetNodeId
                        });
                        drawConnections();
                    }
                }
            }
            
            if (tempLine) {
                tempLine.remove();
                tempLine = null;
            }
            connectingPort = null;
        }
    });

    const drawConnections = () => {
        svgLayer.innerHTML = ''; 
        const rect = dropzone.getBoundingClientRect();
        
        connections.forEach(conn => {
            const sourceNode = nodes[conn.sourceId]?.elem;
            const targetNode = nodes[conn.targetId]?.elem;
            if (!sourceNode || !targetNode) return;
            
            // Just use right port of source, left port of target for visual simplicity
            const sourcePort = sourceNode.querySelector('.port.right');
            const targetPort = targetNode.querySelector('.port.left');
            if(!sourcePort || !targetPort) return;
            
            const sRect = sourcePort.getBoundingClientRect();
            const tRect = targetPort.getBoundingClientRect();
            
            const sx = sRect.left + sRect.width/2 - rect.left;
            const sy = sRect.top + sRect.height/2 - rect.top;
            const tx = tRect.left + tRect.width/2 - rect.left;
            const ty = tRect.top + tRect.height/2 - rect.top;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'connection-line');
            
            const cpX = (sx + tx) / 2;
            const d = `M ${sx} ${sy} C ${cpX} ${sy}, ${cpX} ${ty}, ${tx} ${ty}`;
            path.setAttribute('d', d);
            
            svgLayer.appendChild(path);
        });
    };

    // Sidebar Logic
    const navWizard = document.getElementById('nav-wizard');
    const navDesigner = document.getElementById('nav-designer');
    const wizardSidebar = document.getElementById('wizardSidebar');
    const closeWizard = document.getElementById('closeWizard');
    const generateBtn = document.getElementById('generateFromWizard');
    
    const openWizard = () => {
        wizardSidebar.classList.add('open');
        navWizard.classList.add('active');
        navDesigner.classList.remove('active');
    };
    
    const closeWizardSidebar = () => {
        wizardSidebar.classList.remove('open');
        navDesigner.classList.add('active');
        navWizard.classList.remove('active');
    };

    navWizard.addEventListener('click', openWizard);
    closeWizard.addEventListener('click', closeWizardSidebar);
    generateBtn.addEventListener('click', () => {
        closeWizardSidebar();
        // Simulate auto-generating architecture on center screen
        createNode({ id: 'ec2', name: 'Amazon EC2', price: 25.40 }, 100, 100);
        createNode({ id: 'rds', name: 'Amazon RDS', price: 15.20 }, 350, 100);
    });
    
    // Chip toggling inside modal
    document.querySelectorAll('.chip-group').forEach(group => {
        group.addEventListener('click', e => {
            if (e.target.classList.contains('chip')) {
                group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    });
});
