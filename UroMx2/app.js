/**
 * UroMxApp - Componente Core Unificado (Parte 1 de 2)
 * Arquitectura modular de subfunciones cortas y lineales.
 */
const UroMxApp = {
    // 1. ESTADO GLOBAL DE CONTROL
    state: {
        mode: 'MX', // 'MX' = Micción, 'DI' = Dilatación
        domOriginal: [],
        domFiltrado: [],
    	datasetDiagnostico: [],
        cachedAverages: { porDia: {}, porDilatacion: {} },
        cachedColors: {},
        selectedMothers: new Set(),
        selectedChildren: new Set(),
    	mostrarCurvasHijosEnGrafica: true,
		botonClinicoActivoID: null,      // Guarda cuál botón está encendido (ej: 'vflow', 'qmax')
		intervaloParpadeoBoton: null,   // Guarda el cronómetro del pestañeo dinámico    
        lastContext: null
    },

    // 2. CONSTANTES DE GROSOR DE TRAZO (REGLAS DE TU PROMPT)
    constants: {
        GOLDEN_RATIO: 1.618033988749895,
        CurvaMGruesa: 2.2,
        CurvaMDelgada: 1.7,
        CurvaHGruesa: 1.2,
    	CurvaHDelgada: 0.90,
    	CurvaFantasma: 1.80,
    	CurvaBoton: 0.75
    },

    // 3. ARRANCAR LA APLICACIÓN (INICIALIZADOR ASÍNCRONO)
    // =========================================================================
    // --- CAMBIO INTEGRADO: DESCOMPRESOR RELACIONAL DE DATOS (MÓDULO 1) [STEM] ---
    // =========================================================================
    init: async function() {
        
        this.setCursorState('wait');
        try {
            // Descarga asíncrona de tu script PHP real de alta velocidad
            const dataUnificada = await this.fetchServerData();
            if (!dataUnificada) return;

            // --- 📍 UNIÓN RELACIONAL EN MEMORIA RAM CONTRA EL ANCHO DE BANDA ---
            let registrosDigeridos = [];

            if (dataUnificada.glosario_clinico && dataUnificada.registros) {
                // Si el JSON viene comprimido desde el PHP, reconstruimos las estructuras [STEM]
                const glosario = dataUnificada.glosario_clinico;
                
                registrosDigeridos = dataUnificada.registros.map(item => {
                    if (item.flujo_mls && Array.isArray(item.flujo_mls)) {
                        // 1. Metemos la puntita: inyectamos un cero artificial al puro inicio del viaje
                     //   item.flujo_mls.unshift(0.000);
                        
                        // 2. Metemos el remate: inyectamos un cero de resguardo al puro final de la lista
                        item.flujo_mls.push(0.000);
                    }
                    if (item.calculos) {
                        // Barremos tus 30 variables dinámicas (Qmax, Vvoid, etc.)
                        Object.keys(item.calculos).forEach(llaveMetrica => {
                            if (glosario[llaveMetrica]) {
                                // Casamos el valor dinámico con los textos estáticos del glosario una sola vez
                                item.calculos[llaveMetrica] = {
                                    ...glosario[llaveMetrica],
                                    valor: item.calculos[llaveMetrica].valor,
                                    semaforo: item.calculos[llaveMetrica].semaforo
                                };
                            }
                        });
                    }
                    return item;
                });
            } else {
                // Resguardo de compatibilidad si el PHP aún entrega el array plano viejo
                registrosDigeridos = Array.isArray(dataUnificada) ? dataUnificada : [];
            }

            // Alimentamos tus variables nativas estables con los datos ya digeridos relacionalmente
            this.state.domOriginal = registrosDigeridos;
            this.state.domFiltrado = [...registrosDigeridos];

            // Despertar la tubería de los siguientes módulos intacta
            this.initModulesPipeline();

        } catch (error) {
            console.error("UroMx Error Crítico en Módulo 1:", error);
        } finally {
            this.setCursorState('default');
        }
    
        if (!document.getElementById('uro-blink-styles')) {
            const estiloAnimacion = document.createElement('style');
            estiloAnimacion.id = 'uro-blink-styles';
            estiloAnimacion.innerHTML = `
                @keyframes uroBlinkAnimation {
                    0% { opacity: 1; }
                    100% { opacity: 0.35; }
                }
            `;
            document.head.appendChild(estiloAnimacion);
        }  
    
document.getElementById('tu-id-de-boton-util').onclick = (e) => {
    e.preventDefault();
    if (UroMxApp.ChartManager && typeof UroMxApp.ChartManager.AnalisisClinico === 'function') {
        UroMxApp.ChartManager.AnalisisClinico();
    }
};    
    },


    // SUBFUNCIÓN: Petición asíncrona limpia
    fetchServerData: async function() {
        const respuesta = await fetch('caudal_parser.php');
        if (!respuesta.ok) {
            console.error("UroMx Error: El servidor no respondió adecuadamente.");
            return null;
        }
        return await respuesta.json();
    },

    // SUBFUNCIÓN: Sincronizador de arranque de módulos
    initModulesPipeline: function() {
    	if (this.FilterManager) this.FilterManager.init();
        this.loadDefaultState();
        this.executeBackgroundProcessing();
    },

    // SUBFUNCIÓN: Control del reloj de arena
    setCursorState: function(estado) {
        document.body.style.cursor = estado;
    },

 
    // 4. MOTOR DE PROMEDIOS EN SEGUNDO PLANO
    executeBackgroundProcessing: function() {
        if (window.requestIdleCallback) {
            requestIdleCallback(() => this.utils.groupAndAverageData());
        } else {
            setTimeout(() => this.utils.groupAndAverageData(), 50);
        }
    },

    // 5. CROMÁTICA ÁUREA EXACTA (ON: Sólido, OFF: Pastel)
    getColor: function(id, isSolid) {
        const llave = `${id}_${isSolid ? 'ON' : 'OFF'}`;
        if (this.state.cachedColors[llave]) {
            return this.state.cachedColors[llave];
        }

        const hue = Math.floor((id * this.constants.GOLDEN_RATIO * 360) % 360);
        const color = isSolid ? `hsl(${hue}, 75%, 40%)` : `hsl(${hue}, 60%, 80%)`;
        
        this.state.cachedColors[llave] = color;
        return color;
    }
};

// UTILERÍAS COMPLEMENTARIAS DE OPERACIÓN MATEMÁTICA Vectorial
UroMxApp.utils = {
    groupAndAverageData: function() {
        const data = UroMxApp.state.domOriginal;
        const tempDia = {};
        const tempDil = {};

        data.forEach(reg => {
            // Extraemos solo el ENTERO para reunir todas las micciones del mismo día
            const idDiaEntero = UroMxApp.state.mode === 'MX' ? Math.floor(Number(reg.idDia)) : Number(reg.idDia);
            const idDilEntero = Math.floor(Number(reg.idDilatacion));

            if (!tempDia[idDiaEntero]) tempDia[idDiaEntero] = [];
            if (!tempDil[idDilEntero]) tempDil[idDilEntero] = [];
            
            tempDia[idDiaEntero].push(reg);
            tempDil[idDilEntero].push(reg);
        });

        this.generateCachedMetrics(tempDia, tempDil);
    },

    generateCachedMetrics: function(tempDia, tempDil) {
        for (const idDia in tempDia) {
            // CORRECCIÓN: Apuntamos directamente a UroMxApp.utils para que herede los datos reales
            UroMxApp.state.cachedAverages.porDia[idDia] = UroMxApp.utils.averageCurvesVector(tempDia[idDia]);
        }
        for (const idDil in tempDil) {
            // CORRECCIÓN: Lo mismo para el canal de las dilataciones unificadas
            UroMxApp.state.cachedAverages.porDilatacion[idDil] = UroMxApp.utils.averageCurvesVector(tempDil[idDil]);
        }
        console.log("UroMx Módulo 2: Matrices de promedios amarradas con éxito en memoria.");
    },

    averageCurvesVector: function(arregloRegistros) {
        if (!arregloRegistros || arregloRegistros.length === 0) return null;
        
        let maxDuracion = 0;
        arregloRegistros.forEach(r => {
            if (r.flujo_mls && r.flujo_mls.length > maxDuracion) maxDuracion = r.flujo_mls.length;
        });

        const curvaPromedio = [];
        for (let seg = 0; seg < maxDuracion; seg++) {
            let suma = 0;
            arregloRegistros.forEach(r => {
                suma += (r.flujo_mls && r.flujo_mls[seg]) ? r.flujo_mls[seg] : 0;
            });
            curvaPromedio.push(suma / arregloRegistros.length);
        }

        return {
            totalMicciones: arregloRegistros.length,
            curva: curvaPromedio,
            volumenConsolidado: arregloRegistros.reduce((acc, el) => acc + el.volTotal, 0) / arregloRegistros.length
        };
    }
};

/**
 * UroMxApp - Componente Core Unificado (Parte 2 de 2)
 * Resuelve: Filtros nativos, Multi-clic amortiguado y Gráficas.
 */

// 1. GESTOR DE FILTRADO AVANZADO (.uro-drawer)
UroMxApp.FilterManager = {
    config: { fechaMinima: '', fechaMaxima: '', horasActivas: Array(24).fill(true) },

    init: function() {
        const datos = UroMxApp.state.domOriginal;
        if (!datos || datos.length === 0) return;

        const fMax = datos[0]?.fecha || '';
        const fMin = datos[datos.length - 1]?.fecha || '';

        this.config.fechaMaxima = fMax.includes(' ') ? fMax.split(' ')[0] : fMax;
        this.config.fechaMinima = fMin.includes(' ') ? fMin.split(' ')[0] : fMin;

        this.bindHTMLElements();
    },

    // SUBFUNCIÓN ATÓMICA: Limpieza y mudanza de piel entre Modo MX y Modo DI (Módulo 3)
    switchVisualPipelineMode: function() {
        console.log(`UroMx: Cambiando tuberías visuales al modo -> ${UroMxApp.state.mode}`);
        
        // 1. Limpiamos por completo la memoria de selecciones anteriores para evitar fantasmas
        UroMxApp.state.selectedMothers.clear();
        UroMxApp.state.selectedChildren.clear();
        UroMxApp.state.mostrarPromedioGlobalGris = false;
        UroMxApp.state.mostrarPromedioKinderGris = false;

        // 2. Escondemos físicamente el Kinder viejo
        const kinder = document.querySelector('.KinderContenedor') || document.getElementById('KinderContenedor');
        if (kinder) kinder.style.display = 'none'; 	

        const tituloSidebar = document.getElementById('lbl-sidebar-titulo') || document.querySelector('.sidebar h2');
        if (tituloSidebar) {
            tituloSidebar.innerText = UroMxApp.state.mode === 'MX' ? 'MICCIÓN' : 'DILATACIÓN';
        }

        // 4. Forzamos al cargador por defecto a simular el nacimiento del nuevo modo
        UroMxApp.loadDefaultState();
    },

	bindHTMLElements: function() {
        const panelDrawer = document.getElementById('uro-drawer');
        
        if (panelDrawer) {
            this.inputDesde = panelDrawer.querySelector('#native-date-desde'); 
            this.inputHasta = panelDrawer.querySelector('#native-date-hasta'); 
            
            // CORREGIDO: Apuntamos exactamente a tu botón maestro del HTML
            this.btnAplicar = panelDrawer.querySelector('#btn-drawer-aplicar');
            this.drawer = panelDrawer;
            
            // Usamos tu sección de rangos de tiempo rápidos como caja para los botones
            this.contenedorBotonesRapidos = panelDrawer.querySelector('.grid-botones-rapidos');
        }

        this.setInitialInputValues();
        this.registerFilterEvents();
    },

    prepareQuickButtonsContainer: function() {
        if (!this.drawer) return;
        let BotonesFiltradoContenedor = document.getElementById('uro-quick-days-container');
        if (!BotonesFiltradoContenedor) {
            BotonesFiltradoContenedor = document.createElement('div');
            BotonesFiltradoContenedor.id = 'uro-quick-days-container';
            BotonesFiltradoContenedor.style.margin = '10px 0';
            BotonesFiltradoContenedor.style.display = 'flex';
            BotonesFiltradoContenedor.style.gap = '0px';
            this.drawer.insertBefore(BotonesFiltradoContenedor, this.drawer.firstChild);
        }
        this.contenedorBotonesRapidos = BotonesFiltradoContenedor;
    },

    setInitialInputValues: function() {
        this.txtDesde = this.drawer.querySelector('#txt-fecha-desde');
        this.txtHasta = this.drawer.querySelector('#txt-fecha-hasta');
        this.txtHoraDesde = this.drawer.querySelector('#txt-hora-desde');
        this.txtHoraHasta = this.drawer.querySelector('#txt-hora-hasta');

        const datos = UroMxApp.state.domOriginal;
        if (!datos || datos.length === 0) return;

        // Extraemos las marcas de tiempo límites reales de tu backend en PHP
        const fReciente = datos[0]?.fecha?.split(' ')[0] || '';
        const fAntigua = datos[datos.length - 1]?.fecha?.split(' ')[0] || '';

        const convertirA_HTML5 = (str) => {
            if (!str || !str.includes('/')) return str;
            const p = str.split('/');
            return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
        };

        const html5Antigua = convertirA_HTML5(fAntigua);
        const html5Reciente = convertirA_HTML5(fReciente);

        // REGLA: Bloqueo estricto de límites en el selector del navegador
        if (this.inputDesde) {
            this.inputDesde.value = html5Antigua;
            this.inputOriginalMin = html5Antigua; // Guardamos el resguardo histórico
            this.inputDesde.min = html5Antigua;
            this.inputDesde.max = html5Reciente;
        }
        if (this.inputHasta) {
            this.inputHasta.value = html5Reciente;
            this.inputOriginalMax = html5Reciente;
            this.inputHasta.min = html5Antigua;
            this.inputHasta.max = html5Reciente;
        }

        // Llenar cuadros visibles en formato dd/mm/yy
        if (this.txtDesde) this.txtDesde.value = fAntigua.substring(0,6) + fAntigua.substring(8,10);
        if (this.txtHasta) this.txtHasta.value = fReciente.substring(0,6) + fReciente.substring(8,10);
        if (this.txtHoraDesde) this.txtHoraDesde.value = "00:00";
        if (this.txtHoraHasta) this.txtHoraHasta.value = "24:00";
    },

    // UBICACIÓN: Dentro de UroMxApp.FilterManager en tu Módulo 3
    ultimoFocoRegistrado: 'HASTA', // Nace apuntando al límite superior por defecto

    // FUNCIÓN DE ACTUALIZACIÓN VISUAL DE TEXTOS EN LOS BOTONES (+ / -)
    updateQuickButtonsOrientation: function(foco) {
        this.ultimoFocoRegistrado = foco;
        const btns = this.drawer.querySelectorAll('.btn-tiempo-rapido');
        
        // Mapeo exacto respetando el formato original de tus botones del HTML
        const mapaDias = { 0: 'Hoy', 3: '3 Días', 7: '7 Días', 15: '15 Días', 30: '30 Días', 365: 'Historial' };

        btns.forEach(btn => {
            const d = Number(btn.getAttribute('data-dias'));
            if (d === 0 || d === 365) {
                btn.innerText = mapaDias[d]; // 'Hoy' e 'Historial' conservan su texto fijo
            } else {
                // Si el foco es DESDE se muestra negativo, si es HASTA se muestra positivo
                btn.innerText = foco === 'DESDE' ? `-${d} Días` : `+${d} Días`;
            }
        });
        console.log(`UroMx: Orientación de botones rápida cambiada a modo -> ${foco}`);
    },

    registerFilterEvents: function() {
        if (this.filtrosYaTienenOidos) return;

        const labelDesde = this.drawer.querySelector('label[for="native-date-desde"]');
        const labelHasta = this.drawer.querySelector('label[for="native-date-hasta"]');
        const btnFiltroMX = this.drawer.querySelector('#btn-filtro-micciones');
        const btnFiltroDI = this.drawer.querySelector('#btn-filtro-dilataciones');

        if (btnFiltroMX && btnFiltroDI) {
            // Al presionar el botón de MICCIONES
            btnFiltroMX.onclick = (e) => {
                e.preventDefault();
                if (UroMxApp.state.mode === 'MX') return; // Si ya está activo, no hacemos nada
                btnFiltroMX.classList.add('active');
                btnFiltroDI.classList.remove('active');
                
                // Cambiamos el modo global y ejecutamos la mudanza limpia
                UroMxApp.state.mode = 'MX';
                this.switchVisualPipelineMode();
                this.executeFilteringMatrix();
                this.drawer.style.left = '-500px';
            
            };

            // Al presionar el botón de DILATACIONES
            btnFiltroDI.onclick = (e) => {
                e.preventDefault();
                if (UroMxApp.state.mode === 'DI') return;
                btnFiltroDI.classList.add('active');
                btnFiltroMX.classList.remove('active');
                
                UroMxApp.state.mode = 'DI';
                this.switchVisualPipelineMode();
                this.executeFilteringMatrix();
                this.drawer.style.left = '-500px';
            
            };
        }
    
        const sincronizarCuadroTexto = (inputReal, cuadroVisible) => {
            const val = inputReal.value;
            if (!val) return;
            const p = val.split('-');
            if (cuadroVisible) cuadroVisible.value = `${p[2]}/${p[1]}/${p[0].substring(2,4)}`;
        };

        // CORREGIDO: El Swap inteligente fuerza el foco a HASTA para mantener la consistencia
        const validarCruceInteligente = () => {
            if (!this.inputDesde.value || !this.inputHasta.value) return;
            const tDesde = new Date(this.inputDesde.value + 'T00:00:00').getTime();
            const tHasta = new Date(this.inputHasta.value + 'T00:00:00').getTime();

            if (tDesde > tHasta) {
                console.log("UroMx: Cruce detectado. Aplicando Swap inteligente...");
                const backupDesde = this.inputDesde.value;
                this.inputDesde.value = this.inputHasta.value;
                this.inputHasta.value = backupDesde;

                sincronizarCuadroTexto(this.inputDesde, this.txtDesde);
                sincronizarCuadroTexto(this.inputHasta, this.txtHasta);
                
                // Forzamos la orientación a HASTA tras el Swap como indicaste
                this.updateQuickButtonsOrientation('HASTA');
            }
        };

        if (labelDesde && this.inputDesde) {
            labelDesde.onclick = (e) => { e.preventDefault(); if (typeof this.inputDesde.showPicker === 'function') this.inputDesde.showPicker(); };
            this.inputDesde.onchange = () => { sincronizarCuadroTexto(this.inputDesde, this.txtDesde); validarCruceInteligente(); };
        }

        if (labelHasta && this.inputHasta) {
            labelHasta.onclick = (e) => { e.preventDefault(); if (typeof this.inputHasta.showPicker === 'function') this.inputHasta.showPicker(); };
            this.inputHasta.onchange = () => { sincronizarCuadroTexto(this.inputHasta, this.txtHasta); validarCruceInteligente(); };
        }

        // Escucha de los botones rápidos de tiempo
        const btnsRapidos = this.drawer.querySelectorAll('.btn-tiempo-rapido');
        btnsRapidos.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const d = Number(btn.getAttribute('data-dias'));
                this.applyDateShift(this.ultimoFocoRegistrado, d);
            };
        });

        // Alternancia de Bloques Horarios
        const btnsHoras = this.drawer.querySelectorAll('.btn-horas-bloque');
        btnsHoras.forEach(btn => { btn.onclick = (e) => { e.preventDefault(); btn.classList.toggle('active'); }; });

        // Botón Limpiar
        const btnLimpiar = this.drawer.querySelector('#btn-drawer-limpiar');
        if (btnLimpiar) {
            btnLimpiar.onclick = (e) => {
                e.preventDefault();
                this.setInitialInputValues();
                btnsHoras.forEach(b => b.classList.add('active'));
                this.updateQuickButtonsOrientation('HASTA');
            };
        }

        // Botón Invertir
        const btnInvertir = this.drawer.querySelector('#btn-drawer-invertir');
        if (btnInvertir) { btnInvertir.onclick = (e) => { e.preventDefault(); btnsHoras.forEach(b => b.classList.toggle('active')); }; }

        // Botón Aplicar Filtro
        if (this.btnAplicar) {
            this.btnAplicar.onclick = (e) => {
                e.preventDefault();
                this.executeFilteringMatrix();
                this.drawer.style.left = '-500px';
            };
        }

        this.filtrosYaTienenOidos = true;
    },

    // UBICACIÓN: Dentro de UroMxApp.FilterManager en tu Módulo 3
    // CORREGIDO: Tubería matemática bidireccional exacta (+ / -) según tu regla de foco
    applyDateShift: function(foco, d) {
        if (!this.inputDesde || !this.inputHasta) return;

        if (d === 365) {
            this.setInitialInputValues();
            this.updateQuickButtonsOrientation('HASTA');
            return;
        }

        // SUBFUNCIÓN INTERNA CORREGIDA CON ÍNDICES EXPLÍCITOS [dd/mm/yy]
        const refrescarTextoVisible = (inputReal, cuadroTexto) => {
            const v = inputReal.value; // Formato yyyy-mm-dd
            if (!v) return;
            const p = v.split('-'); // p[0]=yyyy, p[1]=mm, p[2]=dd
            
            if (cuadroTexto) {
                // CORREGIDO: p[2] es el día, p[1] es el mes y p[0] es el año al que le recortamos 2 dígitos
                cuadroTexto.value = `${p[2]}/${p[1]}/${p[0].substring(2, 4)}`;
            }
        };

        // CASO BOTÓN 0 ("Hoy"): El igualador virtual perfecto que junta las dos fechas
        if (d === 0) {
            console.log(`UroMx: Igualando fechas hacia el último foco activo -> ${foco}`);
            if (foco === 'HASTA') {
                this.inputDesde.value = this.inputHasta.value;
                refrescarTextoVisible(this.inputDesde, this.txtDesde);
            } else {
                this.inputHasta.value = this.inputDesde.value;
                refrescarTextoVisible(this.inputHasta, this.txtHasta);
            }
            return;
        }

        const tMinimoHistorico = new Date(this.inputOriginalMin + 'T00:00:00').getTime();
        const tMaximoHistorico = new Date(this.inputOriginalMax + 'T00:00:00').getTime();

        if (foco === 'HASTA') {
            // REGLA MAESTRA: El foco está en HASTA (los botones dicen +3, +7)
            // Tomamos lo que dice DESDE en la pantalla y le SUMAMOS los días hacia adelante
            let fechaActualDesde = new Date(this.inputDesde.value + 'T00:00:00');
            if (isNaN(fechaActualDesde.getTime())) fechaActualDesde = new Date(this.inputOriginalMin + 'T00:00:00');

            // CORREGIDO: Operación de suma (+) para avanzar el DESDE de 01 a 04 como indicaste
            fechaActualDesde.setDate(fechaActualDesde.getDate() + d);
            
            // Candado de seguridad: no puede rebasar el límite superior actual del HASTA
            const tLimiteHasta = new Date(this.inputHasta.value + 'T00:00:00').getTime();

            if (fechaActualDesde.getTime() > tLimiteHasta) {
                this.inputDesde.value = this.inputHasta.value; // Se igualan si se pasa
            } else {
                const y = fechaActualDesde.getFullYear(), m = String(fechaActualDesde.getMonth()+1).padStart(2,'0'), day = String(fechaActualDesde.getDate()).padStart(2,'0');
                this.inputDesde.value = `${y}-${m}-${day}`;
            }
            refrescarTextoVisible(this.inputDesde, this.txtDesde);
        } 
        else {
            // REGLA MAESTRA: El foco está en DESDE (los botones dicen -3, -7)
            // Tomamos lo que dice HASTA en la pantalla y le RESTAMOS los días hacia atrás
            let fechaActualHasta = new Date(this.inputHasta.value + 'T00:00:00');
            if (isNaN(fechaActualHasta.getTime())) fechaActualHasta = new Date(this.inputOriginalMax + 'T00:00:00');

            // CORREGIDO: Operación de resta (-) para jalar el HASTA hacia atrás
            fechaActualHasta.setDate(fechaActualHasta.getDate() - d);
            
            // Candado de seguridad: no puede ir más atrás del límite inferior actual del DESDE
            const tLimiteDesde = new Date(this.inputDesde.value + 'T00:00:00').getTime();

            if (fechaActualHasta.getTime() < tLimiteDesde) {
                this.inputHasta.value = this.inputDesde.value; // Se igualan si se pasa
            } else {
                const y = fechaActualHasta.getFullYear(), m = String(fechaActualHasta.getMonth()+1).padStart(2,'0'), day = String(fechaActualHasta.getDate()).padStart(2,'0');
                this.inputHasta.value = `${y}-${m}-${day}`;
            }
            refrescarTextoVisible(this.inputHasta, this.txtHasta);
        }
    },

	formatToHTML5: function(str) {
        if (!str || !str.includes('/')) return str;
        const p = str.split('/');
        return `${p[2]}-${p[1]}-${p[0]}`; // dd/mm/yyyy -> yyyy-mm-dd
    },

    formatToPHP: function(str) {
        if (!str || !str.includes('-')) return str;
        const p = str.split('-');
        return `${p[2]}/${p[1]}/${p[0]}`; // yyyy-mm-dd -> dd/mm/yyyy
    },

    renderQuickButtons: function(signo) {
        if (!this.contenedorBotonesRapidos) return;
        this.contenedorBotonesRapidos.innerHTML = ''; 

        // CORREGIDO: Arreglo explícito con los días solicitados en tu prompt
        const dias = [0, 3, 7, 15, 30, 365];
        dias.forEach(d => {
            const b = document.createElement('button');
            b.className = 'btn-quick-day-uro';
            b.style.padding = '4px 6px';
            b.style.fontSize = '12px';
            b.innerText = d === 365 ? 'HISTORIAL' : `${signo}${d}`;
            b.onclick = (e) => { e.preventDefault(); this.applyDateShift(signo, d); };
            this.contenedorBotonesRapidos.appendChild(b);
        });
    },

    // 3. MOTOR DE RECORTE MATRICIAL DE FECHAS Y HORAS [STEM] (MÓDULO 3)
    executeFilteringMatrix: function() {
        UroMxApp.setCursorState('wait');

        if (!this.inputDesde || !this.inputHasta || !this.inputDesde.value || !this.inputHasta.value) {
            UroMxApp.setCursorState('default');
            return;
        }

        // A) Marcas de tiempo numéricas para el rango de días
        const tiempoDesde = new Date(this.inputDesde.value + 'T00:00:00').getTime();
        const tiempoHasta = new Date(this.inputHasta.value + 'T23:59:59').getTime();

        // B) Escaneo de Bloques Horarios Activos
        // Buscamos tus botones reales que tengan la clase 'active'
        const botonesHorasActivos = this.drawer.querySelectorAll('.btn-horas-bloque.active');
        const bloquesPermitidos = Array.from(botonesHorasActivos).map(btn => btn.getAttribute('data-bloque'));

        // C) El Gran Filtro Cruzado sobre la Base de Datos
        UroMxApp.state.domFiltrado = UroMxApp.state.domOriginal.filter(item => {
            if (!item.fecha || !item.fecha.includes(' ')) return false;

            // Separamos la fecha de la hora (ej: "15/06/2026 14:25")
            const partes = item.fecha.split(' ');
            const strFecha = partes[0]; // "15/06/2026"
            const strHora = partes[1];  // "14:25"

            // 1. VALIDACIÓN DE FECHA: Convertimos dd/mm/yyyy a yyyy-mm-dd estándar
            const pF = strFecha.split('/');
            const fechaISO = `${pF[2]}-${pF[1]}-${pF[0]}`;
            const tiempoItem = new Date(fechaISO + 'T00:00:00').getTime();

            const pasaFecha = (tiempoItem >= tiempoDesde && tiempoItem <= tiempoHasta);

            // 2. VALIDACIÓN DE HORA: Evaluamos a qué bloque numérico pertenece el elemento [STEM]
            const horaEntera = parseInt(strHora.split(':')[0], 10);
            
            // Determinamos su etiqueta de bloque exacta idéntica a tu data-bloque del HTML
            let bloqueDelItem = "";
            if (horaEntera >= 2 && horaEntera < 6) bloqueDelItem = "02-06";
            else if (horaEntera >= 6 && horaEntera < 10) bloqueDelItem = "06-10";
            else if (horaEntera >= 10 && horaEntera < 14) bloqueDelItem = "10-14";
            else if (horaEntera >= 14 && horaEntera < 18) bloqueDelItem = "14-18";
            else if (horaEntera >= 18 && horaEntera < 22) bloqueDelItem = "18-22";
            else if (horaEntera >= 22 || horaEntera < 2) bloqueDelItem = "22-02";

            const pasaHora = bloquesPermitidos.includes(bloqueDelItem);

            // El registro sobrevive sólo si pasa ambos candados clínicos en simultáneo
            return (pasaFecha && pasaHora);
        });

        // D) Despertar la tubería visual con los datos ya recortados
        if (UroMxApp.InteractionManager) {
            // Reconstruye los paneles de madres e hijos de forma automática
            UroMxApp.InteractionManager.rebuildInterfacePipeline();
        }

        UroMxApp.setCursorState('default');
        console.log(`UroMx Módulo 3: Matriz ejecutada. Sobrevivieron ${UroMxApp.state.domFiltrado.length} registros.`);
    },

    toggleClinicalButtonBlink: function(idBotonPresionado, elementoBoton) {
        // 1. Limpiamos cualquier parpadeo anterior si el usuario salta de un botón a otro
        if (UroMxApp.state.intervaloParpadeoBoton) {
            clearInterval(UroMxApp.state.intervaloParpadeoBoton);
            UroMxApp.state.intervaloParpadeoBoton = null;
            
            // Regresamos todos los botones clínicos a su opacidad normal
            this.drawer.querySelectorAll('.btn-master-aplicar, .btn-accion-dr, .btn-tiempo-rapido').forEach(b => {
                b.style.opacity = '1';
                b.style.backgroundColor = ''; 
            });
        }

        // Si el usuario volvió a presionar el mismo botón que ya estaba activo, se apaga el modo clínico
        if (UroMxApp.state.botonClinicoActivoID === idBotonPresionado) {
            UroMxApp.state.botonClinicoActivoID = null;
            console.log(`UroMx: Botón clínico ${idBotonPresionado} desactivado. Regresando a gráfica normal.`);
            UroMxApp.ChartManager.renderChartPipeline(); // Redibuja tus curvas normales de segundos
            return;
        }

        // 2. Encendemos el nuevo botón activo en la memoria
        UroMxApp.state.botonClinicoActivoID = idBotonPresionado;
        console.log(`UroMx: Activando análisis clínico avanzado para la métrica -> ${idBotonPresionado}`);

        let alternarColorPastel = false;
        const colorOriginalFijo = elementoBoton.style.backgroundColor || '#0066cc';

        // 3. CRONÓMETRO DE PESTAÑEO: Altera la opacidad/color cada 400 milisegundos de forma infinita
        UroMxApp.state.intervaloParpadeoBoton = setInterval(() => {
            if (!elementoBoton) return;
            
            if (alternarColorPastel) {
                // Tono pastel suave solicitado
                elementoBoton.style.opacity = '0.45';
            } else {
                // Color original intenso
                elementoBoton.style.opacity = '1';
            }
            alternarColorPastel = !alternarColorPastel;
        }, 400);

        // Disparamos el pipeline visual para que la gráfica se entere de que debe transformarse
        UroMxApp.ChartManager.renderChartPipeline();
    },

};

// 2. GESTOR DE MULTI-CLIC Y PANEL DE MADRES/HIJOS
UroMxApp.InteractionManager = {
    clickTimers: {}, clickCounts: {}, debounceTimer: null,

    init: function() { this.rebuildInterfacePipeline(); },

    buildMothersPanel: function() {
      
    	const Cafeteria = document.getElementById('Cafeteria');
        if (!Cafeteria) return;
        Cafeteria.innerHTML = ''; 
        Cafeteria.style.display = 'flex';
        Cafeteria.style.flexDirection = 'column';
        Cafeteria.style.gap = '0px'; //@Espacio entre botones

        const diasRegistrados = new Set();

        UroMxApp.state.domFiltrado.forEach(item => {
            const rawId = UroMxApp.state.mode === 'MX' ? item.idDia : item.idDilatacion;
            
            // CORREGIDO: Extraemos solo el ENTERO (ej: 0.1 -> 0) para agrupar por día real
            // Si es Modo DI, se queda con su ID original
            const idAgrupadorNum = UroMxApp.state.mode === 'MX' ? Math.floor(Number(rawId)) : Number(rawId);
            const idAgrupadorStr = Math.floor(Number(rawId)).toString();

            if (!diasRegistrados.has(idAgrupadorStr)) {
                diasRegistrados.add(idAgrupadorStr); 

            
                const BotonMadre = document.createElement('button');	//BOTONMADRE
                BotonMadre.dataset.idMadreReal = idAgrupadorNum.toString();  
            	BotonMadre.style.width = '80px';
                BotonMadre.style.boxSizing = 'border-box';
                BotonMadre.style.padding = '8px 4px';
                BotonMadre.style.fontSize = '14px';
                BotonMadre.style.fontWeight = 'bold';
                BotonMadre.style.border = 'none';
                BotonMadre.style.borderRadius = '0 0 12px 0px';
                BotonMadre.style.cursor = 'pointer';
            	BotonMadre.style.gap = '0px';

                if (UroMxApp.state.mode === 'MX') {
                    BotonMadre.innerText = item.fecha.substring(0, 5); // DD/MM
                    // El color se basa en el entero del día
                    BotonMadre.style.border = `0.5px solid ${UroMxApp.getColor(idAgrupadorNum, true)}`;
                	BotonMadre.style.borderLeft = `5px solid ${UroMxApp.getColor(idAgrupadorNum, true)}`;
                	BotonMadre.style.borderBottom = `2px solid ${UroMxApp.getColor(idAgrupadorNum, true)}`;
                } else {
                    BotonMadre.innerText = `#${item.idDilatacion} ${item.frSonda}Fr`;
                    BotonMadre.style.borderLeft = `5px solid ${UroMxApp.getColor(rawId, true)}`;
                }

                // La selección y los clics se mandan con el ID entero para agrupar la lógica
                const isOn = UroMxApp.state.selectedMothers.has(idAgrupadorNum);
                this.applyDynamicCromatica(BotonMadre, isOn, idAgrupadorNum);
                
                BotonMadre.onclick = (e) => this.catchClickSequence(e, 'MADRE', idAgrupadorNum);
            
				BotonMadre.onmouseenter = () => {

                if (UroMxApp.ChartManager && typeof UroMxApp.ChartManager.injectTemporaryHoverCurve === 'function') {
				        UroMxApp.ChartManager.injectTemporaryHoverCurve('MADRE', idAgrupadorNum);
					    }
				};
				BotonMadre.onmouseleave = () => {
				    if (UroMxApp.ChartManager && typeof UroMxApp.ChartManager.removeTemporaryHoverCurve === 'function') {
        				UroMxApp.ChartManager.removeTemporaryHoverCurve();
    				}
				};            
                Cafeteria.appendChild(BotonMadre);
            }
        });
    },

    triggerLabelBlinkCombo: function(idIdentificador, encender, criterioOpcional) {
        // 1. LIMPIEZA TOTAL: Apagamos el parpadeo en todas las etiquetas de la pantalla
        document.querySelectorAll('[data-id-madre-real], [data-id-hijo-real]').forEach(elemento => {
            elemento.style.animation = 'none';
            elemento.style.opacity = '1';
        });

        // --- 📍 CANDADO REQUERIDO: ABORTA SI HAY UN BOTÓN CLÍNICO PARPADEANDO ---
        // Si el usuario activó una tarjeta de cálculos, no se enciende ninguna etiqueta de madre o hijo
        if (UroMxApp.state.botonClinicoActivo) return;

        if (!encender || idIdentificador === null || idIdentificador === undefined) return;

        const idBuscadoStr = idIdentificador.toString();
        const modoAplicacion = UroMxApp.state.mode; // 'MX' o 'DI'

        // 2. DISCRIMINADOR ESTRICTO BASADO EN LA NATURALEZA DE TUS PASAPORTES
        if (modoAplicacion === 'MX') {
            if (criterioOpcional === 'idDia') {
                // En MX, idDia representa estrictamente a la Madre (Día)
                const objetivoMadre = document.querySelector(`[data-id-madre-real="${idBuscadoStr}"]`);
                if (objetivoMadre) objetivoMadre.style.animation = 'uroBlinkAnimation 0.5s infinite alternate';
            } else if (criterioOpcional === 'idMix') {
                // En MX, idMix representa estrictamente al Hijo (Micción)
                const objetivoHijo = document.querySelector(`[data-id-hijo-real="${idBuscadoStr}"]`);
                if (objetivoHijo) objetivoHijo.style.animation = 'uroBlinkAnimation 0.5s infinite alternate';
            }
        } else {
            // MODO DILATACIÓN (DI): Sigue tu regla exacta
            if (criterioOpcional === 'idDilatacion') {
                // En DI, idDilatacion representa estrictamente a la Madre (Sonda)
                const objetivoMadre = document.querySelector(`[data-id-madre-real="${idBuscadoStr}"]`);
                if (objetivoMadre) objetivoMadre.style.animation = 'uroBlinkAnimation 0.5s infinite alternate';
            } else if (criterioOpcional === 'idDia') {
                // REGLA EN DI: Los hijos se basan en idDia (Días hermanos)
                const objetivoHijo = document.querySelector(`[data-id-hijo-real="${idBuscadoStr}"]`);
                if (objetivoHijo) objetivoHijo.style.animation = 'uroBlinkAnimation 0.5s infinite alternate';
            }
        }
    },

    applyDynamicCromatica: function(btn, isOn, idColor, esMadre = true) {
        if (isOn) {
            btn.style.backgroundColor = UroMxApp.getColor(idColor, true); // Fondo Sólido (ON)
            btn.style.color = '#ffffff'; // Texto Blanco obligado
            
            // Si es Madre, aplica borde pastel. Si es Hijo, no tocamos su borde aquí (se configuró en su panel)
            if (esMadre) {
                btn.style.borderLeft = `7px solid ${UroMxApp.getColor(idColor, false)}`;
            	btn.style.borderBottom = `2px solid ${UroMxApp.getColor(idColor, false)}`;
            }
        } else {
            btn.style.backgroundColor = UroMxApp.getColor(idColor, false); // Fondo Pastel (OFF)
            btn.style.color = '#999999'; // Texto Negro obligado
            
            // Si es Madre, aplica borde sólido original
            if (esMadre) {
                btn.style.borderLeft = `7px solid ${UroMxApp.getColor(idColor, true)}`;
            	btn.style.borderBottom = `2px solid ${UroMxApp.getColor(idColor, true)}`;
            }
        }
    },

	catchClickSequence: function(e, tipo, id) {
        e.preventDefault();
        const llave = `${tipo}_${id}`;
        this.clickCounts[llave] = (this.clickCounts[llave] || 0) + 1;

        if (this.clickTimers[llave]) clearTimeout(this.clickTimers[llave]);
        this.clickTimers[llave] = setTimeout(() => {
            const clicks = this.clickCounts[llave];
            this.clickCounts[llave] = 0;
            if (tipo === 'MADRE') this.processMotherClicks(clicks, id);
            else this.processChildClicks(clicks, id);
        }, 300);
    },

    // 1. REGLAS DE NEGOCIO PARA CLICS EN MADRES (CORREGIDO PARA ENTEROS)
    // 1. CONTROL DE CLICS EN MADRES CORREGIDO (MÓDULO 4)
    processMotherClicks: function(clicks, id) {
        const idEntero = Math.floor(Number(id));

        // Caso Triple Clic Histórico (Intacto)
        if (clicks >= 3) {
            UroMxApp.state.mostrarPromedioGlobalGris = !UroMxApp.state.mostrarPromedioGlobalGris;
            this.fireExecutionPipeline('TRIPLE_MADRE', idEntero);
            return;
        }

        // Apagar los modos de triple clic ante cualquier nueva acción normal
        UroMxApp.state.mostrarPromedioGlobalGris = false;
        UroMxApp.state.mostrarPromedioKinderGris = false;

        let contextoAccion = 'NORMAL_MADRE';

        if (clicks === 2) {
            UroMxApp.state.selectedChildren.clear(); // Los hijos nacen en OFF al cambiar de día

            if (UroMxApp.state.selectedMothers.has(idEntero)) {
                UroMxApp.state.selectedMothers.delete(idEntero);
                contextoAccion = 'MADRE_PASO_A_OFF'; // Guardamos el estatus si se apagó
            } else {
                UroMxApp.state.selectedMothers.clear();
                UroMxApp.state.selectedMothers.add(idEntero);
                contextoAccion = 'NORMAL_MADRE'; // Guardamos el estatus si se encendió (ON)
            }
        } else if (clicks === 1) {
            if (UroMxApp.state.selectedMothers.has(idEntero)) {
                UroMxApp.state.selectedMothers.delete(idEntero);
                contextoAccion = 'MADRE_PASO_A_OFF';
            } else {
                UroMxApp.state.selectedMothers.add(idEntero);
                contextoAccion = 'NORMAL_MADRE';
            }
        }

        // Si se apagaron todas las madres, regresa al resguardo del nacimiento del Día 0
        if (UroMxApp.state.selectedMothers.size === 0) {
            UroMxApp.loadDefaultState();
            return;
        }

        // Le mandamos al pipeline el contexto real de la última acción (ON u OFF)
        this.fireExecutionPipeline(contextoAccion, idEntero);
    },


    // 2. CONSTRUCTOR DEL KINDER CON BARRA DE TÍTULO Y OCULTAMIENTO INTELIGENTE (MÓDULO 4)
    buildKinderPanel: function() {
        let cajaKinder = document.getElementById('KinderContenedor');

        if (!cajaKinder) {
            cajaKinder = document.createElement('div');
            cajaKinder.className = 'KinderContenedor';
            cajaKinder.id = 'KinderContenedor';
            document.body.appendChild(cajaKinder);
            
            // --- REGLA SOLICITADA: ESCUCHA DE PROXIMIDAD (HOVER) SOBRE LAS MADRES ---
            // Buscamos tu barra lateral izquierda real por sus IDs de tu index.php
            const Cafeteria = document.getElementById('Cafeteria') || 
                                         document.querySelector('.sidebar') || 
                                         document.querySelector('.seccion-controles');
            
            if (Cafeteria) {
                // En cuanto el usuario mueva el mouse por encima de la zona de las madres (Hover)
            	Cafeteria.onmouseenter = () => {    				
                	const panelKinder = document.getElementById('KinderContenedor');
                    // Si el Kinder existe y está en modo fantasma transparente, lo despertamos de golpe
                    if (panelKinder && panelKinder.style.display === 'block' && panelKinder.style.opacity === '0.01') {
                        console.log("UroMx: Despertando Kinder por proximidad sobre el panel de madres.");
                        panelKinder.style.opacity = '1';
                        panelKinder.style.pointerEvents = 'auto'; // Reactiva los clics en los botones
                    }
                };
            }
        }
        cajaKinder.innerHTML = '';

        if (UroMxApp.state.selectedMothers.size === 0) {
            cajaKinder.style.display = 'none';
            return;
        }

        // Si el usuario ya lo había ocultado y sigue en pantalla, respetamos su estado fantasma al redibujar
        const estabaOculto = cajaKinder.style.opacity === '0.01';

        cajaKinder.style.display = 'block';
        cajaKinder.style.visibility = 'visible';
        cajaKinder.style.opacity = estabaOculto ? '0.01' : '1';
        cajaKinder.style.pointerEvents = estabaOculto ? 'none' : 'auto';
        
        // Estilos físicos base
        cajaKinder.style.position = 'fixed';
        if (cajaKinder.style.right === '' && cajaKinder.style.left === '') {
            cajaKinder.style.left = '120px';
            cajaKinder.style.top = '5px';
        }
        cajaKinder.style.width = '190px';
        cajaKinder.style.maxHeight = '380px';
        cajaKinder.style.backgroundColor = '#f1f5f9';
        cajaKinder.style.boxShadow = '0 6px 16px rgba(0,0,0,0.25)';
        cajaKinder.style.borderRadius = '0 0 12px 12px';
        cajaKinder.style.padding = '0px'; // Quitamos padding general para escuadrar la barra de título
        cajaKinder.style.zIndex = '99999';
        cajaKinder.style.overflow = 'hidden'; // Protege las esquinas redondeadas de la barra

        // --- INYECCIÓN DE LA BARRA DE TÍTULO DINÁMICA REQUERIDA ---
        const textoTitulo = UroMxApp.state.mode === 'MX' ? 'Micciones individuales' : 'Micciones diarias';
        
        const barraTitulo = document.createElement('div');
        barraTitulo.id = 'kinder-drawer-handle';
        barraTitulo.style.backgroundColor = '#34495e'; // Gris claro clínico sutil
        barraTitulo.style.padding = '6px 8px';
        barraTitulo.style.borderBottom = '1px solid #e9ecef';
        barraTitulo.style.display = 'flex';
        barraTitulo.style.justifyContent = 'space-between';
        barraTitulo.style.alignItems = 'center';
        barraTitulo.style.cursor = 'move'; // Mano de arrastre fija en el título
        
        barraTitulo.innerHTML = `
            <span style="font-size: 11px; font-weight: bold; color: #ffffff; font-family: sans-serif; text-transform: uppercase;">${textoTitulo}</span>
            <button id="btn-ocultar-kinder" style="background: none; border: none; font-size: 15px; cursor: pointer; color: #adb5bd; padding: 0; line-height: 1;" title="Cerrar ventana">×</button>
        `;

        // CONECTAMOS LA TACHA DE OCULTAMIENTO PASIVO (TRANSPARENTE)
        barraTitulo.querySelector('#btn-ocultar-kinder').onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            console.log("UroMx: Ocultando Kinder y apagando curvas de hijos.");
            cajaKinder.style.opacity = '0.01';
            cajaKinder.style.pointerEvents = 'none';
            
            // APAGAMOS LAS CURVAS Y RE-GRAFICAMOS DE GOLPE
            UroMxApp.state.mostrarCurvasHijosEnGrafica = false;
            UroMxApp.ChartManager.renderChartPipeline();
        };

        cajaKinder.appendChild(barraTitulo);

        // Contenedor interno con scroll exclusivamente para los botones hijos
        const cuerpoBotones = document.createElement('div');
        cuerpoBotones.style.padding = '2px 2px';
        cuerpoBotones.style.maxHeight = '320px';
        cuerpoBotones.style.overflowY = 'auto';
        cuerpoBotones.style.boxSizing = 'border-box';

        // --- MOTOR ARRASTRABLE 100% FLUIDO ASIGNADO A LA BARRA DE TÍTULO [STEM] ---
        // A) DISPARADOR TRADICIONAL PARA PC (RATÓN)
        barraTitulo.onmousedown = (ev) => {
            if (ev.target.tagName === 'BUTTON') return;
            ev.preventDefault();
            
            const cajaReal = cajaKinder.getBoundingClientRect();
            const desfasamientoX = ev.clientX - cajaReal.left;
            const desfasamientoY = ev.clientY - cajaReal.top;
            
            document.onmousemove = (movEv) => {
                movEv.preventDefault();
                
                // Medimos las dimensiones físicas reales del contenedor y la pantalla del monitor [STEM]
                const anchoVentana = window.innerWidth;
                const altoVentana = window.innerHeight;
                const anchoCaja = cajaReal.width;
                const altoCaja = cajaReal.height;

                // Calculamos las posiciones deseadas en pixeles
                let nuevoLeft = movEv.clientX - desfasamientoX;
                let nuevoTop = movEv.clientY - desfasamientoY;

                // --- CANDADO PERIMETRAL ABSOLUTO EN PC (EMBUDO MATEMÁTICO CONTRA DESBORDES) [STEM] ---
                nuevoLeft = Math.max(0, Math.min(anchoVentana - anchoCaja, nuevoLeft));
                nuevoTop = Math.max(0, Math.min(altoVentana - altoCaja, nuevoTop));

                cajaKinder.style.left = `${nuevoLeft + window.scrollX}px`;
                cajaKinder.style.top = `${nuevoTop + window.scrollY}px`;
                cajaKinder.style.gap = '0px';
                cajaKinder.style.padding = '0px';
                cajaKinder.style.right = 'auto';
            };
            
            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };

        // B) DISPARADOR TÁCTIL PARA CELULARES (CON CONTROL DE LÍMITES VIEWPORT) [STEM]
        barraTitulo.addEventListener('touchstart', (ev) => {
            if (ev.target.tagName === 'BUTTON') return;
            if (ev.touches.length > 1) return;

            const toqueInicial = ev.touches[0];
            const cajaReal = cajaKinder.getBoundingClientRect();
            
            const desfasamientoX = toqueInicial.clientX - cajaReal.left;
            const desfasamientoY = toqueInicial.clientY - cajaReal.top;

            const moverKinderTactil = (movEv) => {
                if (movEv.touches.length > 1) return;
                movEv.preventDefault(); 
                
                const toqueActual = movEv.touches[0];
                const anchoVentana = window.innerWidth;
                const altoVentana = window.innerHeight;
                const anchoCaja = cajaReal.width;
                const altoCaja = cajaReal.height;

                let nuevoLeft = toqueActual.clientX - desfasamientoX;
                let nuevoTop = toqueActual.clientY - desfasamientoY;

                // --- CANDADO PERIMETRAL ABSOLUTO EN MÓVIL (QUITA LA RIGIDEZ Y ENJAULA LA CAJA) [STEM] ---
                nuevoLeft = Math.max(0, Math.min(anchoVentana - anchoCaja, nuevoLeft));
                nuevoTop = Math.max(0, Math.min(altoVentana - altoCaja, nuevoTop));

                cajaKinder.style.left = `${nuevoLeft + window.scrollX}px`;
                cajaKinder.style.top = `${nuevoTop + window.scrollY}px`;
                cajaKinder.style.gap = '0px';
                cajaKinder.style.padding = '0px';
                cajaKinder.style.right = 'auto';
            
            };

            const detenerKinderTactil = () => {
                document.removeEventListener('touchmove', moverKinderTactil);
                document.removeEventListener('touchend', detenerKinderTactil);
            };

            document.addEventListener('touchmove', moverKinderTactil, { passive: false });
            document.addEventListener('touchend', detenerKinderTactil);
        }, { passive: true });

        // --- CONSTRUCCIÓN DE BOTONES DE LOS HIJOS (INTACTA CON TU FILTRO ANTERIOR) ---
        const diasInyectadosEnKinder = new Set();

        UroMxApp.state.domFiltrado.forEach(item => {
            const rawIdAsociado = UroMxApp.state.mode === 'MX' ? item.idDia : item.idDilatacion;
            const idMadreEvaluada = Math.floor(Number(rawIdAsociado));

            if (UroMxApp.state.selectedMothers.has(idMadreEvaluada)) {
                const idHijoUnico = UroMxApp.state.mode === 'MX' ? item.idMix : Math.floor(Number(item.idDia));
                const idHijoStr = idHijoUnico.toString();

                if (UroMxApp.state.mode === 'DI' && diasInyectadosEnKinder.has(idHijoStr)) return;
                if (UroMxApp.state.mode === 'DI') diasInyectadosEnKinder.add(idHijoStr);

                const BotonHijo = document.createElement('button');
            	BotonHijo.dataset.idHijoReal = idHijoUnico.toString();
                BotonHijo.style.width = '33%';
                BotonHijo.style.padding = '8px 4px';
                BotonHijo.style.cursor = 'pointer';
                BotonHijo.style.marginBottom = '0px';
                BotonHijo.style.fontSize = '14px';
                BotonHijo.style.fontWeight = 'bold';
                BotonHijo.style.border = 'none';
                BotonHijo.style.borderRadius = '0 0 12px 0px';
   
                if (UroMxApp.state.mode === 'MX') {   //texto hijos 
                    BotonHijo.innerText = item.fecha.substring(11, 16);
                } else {
                    BotonHijo.innerText = `${item.fecha.substring(0, 5)}`;   
                }

                BotonHijo.style.border = `0.5px solid ${UroMxApp.getColor(idMadreEvaluada, true)}`;
            	BotonHijo.style.borderLeft = `7px solid ${UroMxApp.getColor(idMadreEvaluada, true)}`;

                const isOn = UroMxApp.state.selectedChildren.has(idHijoUnico);
                this.applyDynamicCromatica(BotonHijo, isOn, idHijoUnico, false);
                
                BotonHijo.onclick = (e) => this.catchClickSequence(e, 'HIJO', idHijoUnico);
            	// Oídos biónicos del puntero para el Hijo
            	BotonHijo.onmouseenter = () => {
                	if (UroMxApp.ChartManager && typeof UroMxApp.ChartManager.injectTemporaryHoverCurve === 'function') {
                    	UroMxApp.ChartManager.injectTemporaryHoverCurve('HIJO', idHijoUnico);
                	}
            	};
            	BotonHijo.onmouseleave = () => {
                	if (UroMxApp.ChartManager && typeof UroMxApp.ChartManager.removeTemporaryHoverCurve === 'function') {
                    	UroMxApp.ChartManager.removeTemporaryHoverCurve();
                	}
            	};
                cuerpoBotones.appendChild(BotonHijo);
            }
        });
        cajaKinder.appendChild(cuerpoBotones);

        // --- INYECCIÓN DE CIERRE ACÁ: EL OÍDO DE PROXIMIDAD ETERNO ---
        const Cafeteria = document.getElementById('Cafeteria') || 
                                     document.querySelector('.sidebar') || 
                                     document.querySelector('.seccion-controles');
        
        if (Cafeteria) {
            Cafeteria.onmouseenter = () => {
                const panelKinderVivo = document.getElementById('KinderContenedor');
            	if (UroMxApp.state.modoDiagnosticoActivo) return;                    //ojo
                
                if (panelKinderVivo && panelKinderVivo.style.display === 'block' && panelKinderVivo.style.opacity === '0.01') {
                    console.log("UroMx: Despertando Kinder y encendiendo curvas de hijos por proximidad.");
                    panelKinderVivo.style.opacity = '1';
                    panelKinderVivo.style.pointerEvents = 'auto';
                	Cafeteria.style.padding = 'none';
                	Cafeteria.style.gap = '0px';
        
                    
                    // ENCENDEMOS LAS CURVAS Y RE-GRAFICAMOS DE GOLPE
                    UroMxApp.state.mostrarCurvasHijosEnGrafica = true;
                    UroMxApp.ChartManager.renderChartPipeline();
                }
            };
        }
    },


    // 3. CONTROL DE CLICS EN HIJOS CORREGIDO (MÓDULO 4)
    processChildClicks: function(clicks, id) {
        if (clicks >= 3) {
            UroMxApp.state.mostrarPromedioKinderGris = !UroMxApp.state.mostrarPromedioKinderGris;
            this.fireExecutionPipeline('TRIPLE_HIJO', id);
            return;
        }

        UroMxApp.state.mostrarPromedioKinderGris = false;
        let contextoAccion = 'NORMAL_HIJO';

        if (clicks === 2) {
            if (UroMxApp.state.selectedChildren.has(id)) {
                UroMxApp.state.selectedChildren.delete(id);
                contextoAccion = 'HIJO_PASO_A_OFF'; // Guardamos el estatus si se apagó
            } else {
                UroMxApp.state.selectedChildren.clear();
                UroMxApp.state.selectedChildren.add(id);
                contextoAccion = 'NORMAL_HIJO'; // Guardamos el estatus si se encendió (ON)
            }
        } else if (clicks === 1) {
            if (UroMxApp.state.selectedChildren.has(id)) {
                UroMxApp.state.selectedChildren.delete(id);
                contextoAccion = 'HIJO_PASO_A_OFF';
            } else {
                UroMxApp.state.selectedChildren.add(id);
                contextoAccion = 'NORMAL_HIJO';
            }
        }

        this.fireExecutionPipeline(contextoAccion, id);
    },


    // UBICACIÓN: Dentro de fireExecutionPipeline en tu Módulo 4 (CORREGIDO)
    // CORREGIDO: Amarra de forma estricta el ID del botón pulsado en el milisegundo real (Módulo 4)
    fireExecutionPipeline: function(contexto, idTrigger) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        UroMxApp.setCursorState('wait');
        
        // CONGELAMOS LAS VARIABLES: Evita que el bucle de pintura borre el ID del último click
        const idFijoDelClic = idTrigger;
        const contextoFijo = contexto;

        this.debounceTimer = setTimeout(() => {
            this.buildMothersPanel();
            this.buildKinderPanel();
            
            // Determinamos el origen físico real del último click
            const origenDisparo = (contextoFijo.includes('MADRE') || contextoFijo === 'INIT') ? 'ORIGEN_MADRE' : 'ORIGEN_HIJO';
            
            // CORRECCIÓN CLAVE: Guardamos en el estado el ID exacto congelado del botón pulsado
            UroMxApp.state.lastContext = { 
                contexto: contextoFijo, 
                id: idFijoDelClic, 
                origen: origenDisparo 
            };
            
            // Disparar los motores clínicos y gráficos con los datos congelados
            if (UroMxApp.CalculationsManager) UroMxApp.CalculationsManager.processCalculations(contextoFijo, idFijoDelClic);
            if (UroMxApp.ChartManager) UroMxApp.ChartManager.renderChartPipeline();
            
            UroMxApp.setCursorState('default');
        }, 200); // 200ms de amortiguación anti-ametrallamiento
    },


    rebuildInterfacePipeline: function() { 
        this.buildMothersPanel(); 
        this.buildKinderPanel(); 
        this.fireExecutionPipeline('INIT', null); 
    }
};

// 3. CANVAS Y RENDERIZADO DE CHART.JS
UroMxApp.ChartManager = {
    chartFlujo: null,

    renderChartPipeline: function() {
        const canvas = document.getElementById('GraficoMiccionCanvas');
        if (!canvas) return;

        canvas.style.display = 'block';
        canvas.style.height = '100%'; 
        canvas.style.width = '100%';

        const datasets = [];
    
    

        // --- REGLA 2A3 DI MÁSTER: TENDENCIAS DINÁMICAS Y EJES UNIVERSALES CONECTADOS AL BACKEND ---
        if (UroMxApp.state.mostrarPromedioGlobalGris && UroMxApp.state.mode === 'DI') {
            
            const parsearFechaClinicaCompleta = (strFechaHora) => {
                if (!strFechaHora || !strFechaHora.includes(' ')) return new Date(0);
                const partesEspacio = strFechaHora.split(' ');
                const componentesFecha = partesEspacio[0].split('/'); // ['dd', 'mm', 'yyyy']
                const componentesHora = partesEspacio[1].split(':');  // ['HH', 'MM']
                return new Date(
                    Number(componentesFecha[2]),       // Año (yyyy)
                    Number(componentesFecha[1]) - 1,   // Mes (0-11 en JS)
                    Number(componentesFecha[0]),       // Día (dd)
                    Number(componentesHora[0] || 0),   // Hora (HH)
                    Number(componentesHora[1] || 0)    // Minuto (MM)
                );
            };

            const miccionesCronologicasEstrictas = [...UroMxApp.state.domFiltrado].sort((a, b) => {
                return parsearFechaClinicaCompleta(a.fecha) - parsearFechaClinicaCompleta(b.fecha);
            });

            let ejeXAcumulado = 0;
            let ultimaFechaCompleta = null;
            
            const puntosLineaDeTiempoUnica = [];
            const puntosPorSonda = {};

            // Variables para rescatar dinámicamente los textos del eje Y de tu base de datos
            let nombreEjeY = "Métrica Clínica Activa";
            let unidadEjeY = "";

            miccionesCronologicasEstrictas.forEach(item => {
                // CORREGIDO: Si no hay botón pulsado por el usuario, por defecto analiza 'qmax' en tu parser
                const metricaBuscadaReal = UroMxApp.state.botonClinicoActivo || 'Qmax';  //@ojo
                
                // Leemos directo los datos del objeto que inyectó tu caudal_parser.php
                const datosMétricaEnPHP = item.calculos ? item.calculos[metricaBuscadaReal] : null;

                // Extraemos el valor, nombre largo y unidad directo de tu estructura del backend
                const valorNumericoReal = datosMétricaEnPHP ? Number(datosMétricaEnPHP.valor || 0) : 0;
                
                if (datosMétricaEnPHP && datosMétricaEnPHP.nombre) {
                    nombreEjeY = datosMétricaEnPHP.nombre;
                    unidadEjeY = datosMétricaEnPHP.unidad || "";
                }

                const fechaActualCompleta = parsearFechaClinicaCompleta(item.fecha);

                if (ultimaFechaCompleta && fechaActualCompleta.getTime() > 0) {
                    const diferenciaMilisegundos = fechaActualCompleta.getTime() - ultimaFechaCompleta.getTime();
                    const diasRealesConFraccion = diferenciaMilisegundos / (1000 * 60 * 60 * 24);

                    if (diasRealesConFraccion > 7) {
                        ejeXAcumulado += 1;
                    } else if (diasRealesConFraccion > 0) {
                        ejeXAcumulado += diasRealesConFraccion;
                    }
                }
                
                if (fechaActualCompleta.getTime() > 0) ultimaFechaCompleta = fechaActualCompleta;
                
                const idMadreEntero = Math.floor(Number(item.idDilatacion));
                const partesTexto = item.fecha.split(' ');

                const puntoCoordenada = { 
                    x: ejeXAcumulado, 
                    y: valorNumericoReal, 
                    idDilatacionPertenece: idMadreEntero,
                    fechaLabel: `${partesTexto[0].substring(0, 5)} ${partesTexto[1] || ''}`,
                    
                    // INYECCIÓN EXTRA: Grabamos el pasaporte genético directo adentro de la coordenada objeto
                    El_Criterio: 'idDilatacion',
                    El_Y_Valor: idMadreEntero
                };

                puntosLineaDeTiempoUnica.push(puntoCoordenada);

                if (!puntosPorSonda[idMadreEntero]) puntosPorSonda[idMadreEntero] = [];
                puntosPorSonda[idMadreEntero].push(puntoCoordenada);
            });

            // SERIE MAESTRA EVOLUTIVA (Tus segmentos fluidos de naipes intactos)
            const datasetsEvolucion = [{
                label: nombreEjeY,
                data: puntosLineaDeTiempoUnica,
                borderWidth: UroMxApp.constants.CurvaMGruesa || 3, 
                showLine: true, spanGaps: false, tension: 0.15, pointRadius: 0, pointHoverRadius: 5,
                segment: { borderColor: ctx => { const pt = ctx.p0.raw; return UroMxApp.getColor(pt ? pt.idDilatacionPertenece : 0, true); } },
                
                // Pasaporte global en el cascarón de la serie
                El_Criterio: 'idDilatacion',
                El_Y_Valor: 'EVOLUCION_LINEAL_DI' //unico lugar correcto
            }];

            // --- ALGORITMO DE MÍNIMOS CUADRADOS VECTORIAL INTEGRADO [STEM] ---
            if (UroMxApp.state.botonClinicoActivo && puntosLineaDeTiempoUnica.length > 1) {
                const calcularRegresionLineal = (puntos) => {
                    const n = puntos.length; if (n < 2) return null;
                    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                    puntos.forEach(p => { sumX += p.x; sumY += p.y; sumXY += (p.x * p.y); sumXX += (p.x * p.x); });
                    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    const b = (sumY - m * sumX) / n;
                    return { m: isNaN(m) ? 0 : m, b: isNaN(b) ? 0 : b };
                };

                // A) Línea de tendencia por sección (Rojo 0.5 de fondo)
                for (const idMadre in puntosPorSonda) {
                    const puntosSonda = puntosPorSonda[idMadre];
                    const rectaIndividual = calcularRegresionLineal(puntosSonda);
                    if (rectaIndividual && puntosSonda.length > 1) {
                        const xMin = puntosSonda.x; const xMax = puntosSonda[puntosSonda.length - 1].x;
                        datasetsEvolucion.unshift({
                            label: `Tend 1189 Dil ${idMadre}`,
                            data: [{ x: xMin, y: rectaIndividual.m * xMin + rectaIndividual.b }, { x: xMax, y: rectaIndividual.m * xMax + rectaIndividual.b }],
                            borderColor: 'rgba(255, 0, 0, 1.5)', 
                            borderWidth: 1.5, showLine: true, pointRadius: 0, order: 0, fill: false,
	                        El_Criterio: 'idDia',  //linea de tendencia de madre en DI
    	                    El_Y_Valor: Math.floor(Number(idMadre))   
                        });
                    }
                }

                // B) Línea de tendencia general (Rojo Obscuro 0.75 de fondo)
                const rectaGeneral = calcularRegresionLineal(puntosLineaDeTiempoUnica);
                if (rectaGeneral) {
                    const xMinGlobal = puntosLineaDeTiempoUnica.x; const xMaxGlobal = puntosLineaDeTiempoUnica[puntosLineaDeTiempoUnica.length - 1].x;
                    datasetsEvolucion.unshift({
                        label: 'Tendencia 1204 General',
                        data: [{ x: xMinGlobal, y: rectaGeneral.m * xMinGlobal + rectaGeneral.b }, { x: xMaxGlobal, y: rectaGeneral.m * xMaxGlobal + rectaGeneral.b }],
                        borderColor: 'rgba(139, 0, 0, 1.75)', 
                        borderWidth: 2.5, showLine: true, pointRadius: 0, order: -1, fill: false,
                        El_Criterio: 'idDia',
                        El_Y_Valor: 24 //Math.floor(Number(mId))                    
                    });
                }
            }

            // Despachamos el dibujo inyectándole dinámicamente el nombre y la unidad del eje
            this.buildAndDrawCanvasEvolutivo(canvas, datasetsEvolucion, nombreEjeY, unidadEjeY);
            return; 
        }

        // --- RESTAURADO: REGLA 2A3 MX - TRIPLE CLIC DE MADRE EN MICCIONES (CURVA GLOBAL MORADA) ---
        if (UroMxApp.state.mostrarPromedioGlobalGris && UroMxApp.state.mode === 'MX') {
            const promGlobalMX = UroMxApp.utils.averageCurvesVector(UroMxApp.state.domFiltrado);
            if (promGlobalMX) {
                datasets.push({
                    label: 'Promedio histórico',  //OKLabel todas las micciones.
                    data: promGlobalMX.curva.map((f, i) => ({ x: i, y: f })),
                    borderColor: '#9600E1', // Tu hermoso morado clínico puro
                	backgroundColor: '#9600E1',
                    order: 9999,
                	borderWidth: 4.5, // Grosor 3 de Madre
                    showLine: true,
                    tension: 0.1,
                    pointRadius: 0, 
                    pointHoverRadius: 0.1,
                    El_Criterio: 'idMix',
                    El_Y_Valor: -1
                });
            }
        }
    
        // REGLA 2B3: TRIPLE CLIC DE HIJO (PROMEDIO MÚLTIPLE DE KÍNDER EN FUCSIA)
        if (UroMxApp.state.mostrarPromedioKinderGris && UroMxApp.state.mode === 'MX') {
            const registrosDelKinder = UroMxApp.state.domFiltrado.filter(item => {
                const rawM = UroMxApp.state.mode === 'MX' ? item.idDia : item.idDilatacion;
                return UroMxApp.state.selectedMothers.has(Math.floor(Number(rawM)));
            });

            const promKinder = UroMxApp.utils.averageCurvesVector(registrosDelKinder);
            if (promKinder) {
                datasets.push({
                    label: 'Promedio de días seleccionados',
                    data: promKinder.curva.map((f, i) => ({ x: i, y: f })),
                    borderColor: '#0629b6',
                	backgroundColor: '#0629b6',
                    borderWidth: 4.5, pointRadius: 0.1,
                    order: 9998,
                    showLine: true,
                    tension: 0.1,
                    pointRadius: 0, // TOTALMENTE FUMIGADAS
                    pointHoverRadius: 0.1,
					El_Criterio: 'idDiaSeleccionado', // Llave secreta para nuestro buscador universal
					El_Y_Valor: Array.from(UroMxApp.state.selectedMothers)
                });
            }
        }    
    
        // --- REGLA 2B3 DI CORREGIDA: SUPERPOSICIÓN EN TIEMPO CERO SÓLO DE DILATACIONES SELECCIONADAS ---
        if (UroMxApp.state.mostrarPromedioKinderGris && UroMxApp.state.mode === 'DI') {
            
            const parsearFechaCompletaDI = (strFechaHora) => {
                if (!strFechaHora || !strFechaHora.includes(' ')) return new Date(0);
                const partesEspacio = strFechaHora.split(' ');
                const componentesFecha = partesEspacio[0].split('/');
                const componentesHora = partesEspacio[1].split(':');
                return new Date(Number(componentesFecha[2]), Number(componentesFecha[1]) - 1, Number(componentesFecha[0]), Number(componentesHora[0] || 0), Number(componentesHora[1] || 0));
            };

            const gruposPorDilatacion = {};
            // Array global para la regresión lineal acumulada
            const todosLosPuntosSuperpuestos = [];

            UroMxApp.state.domFiltrado.forEach(item => {
                const idMadreEntero = Math.floor(Number(item.idDilatacion));
                
                // CANDADO CRUCIAL: El registro se procesa SÓLO si su madre/dilatación está seleccionada (ON)
                if (UroMxApp.state.selectedMothers.has(idMadreEntero)) {
                    if (!gruposPorDilatacion[idMadreEntero]) {
                        gruposPorDilatacion[idMadreEntero] = [];
                    }
                    gruposPorDilatacion[idMadreEntero].push(item);
                }
            });

            const datasetsSuperposicion = [];
            const metricaActivaLimpia = UroMxApp.state.botonClinicoActivo || 'Qmax'; // Tu ID limpio de PHP
            let nombreEjeY = "Flujo Máximo";
            let unidadEjeY = "mL/s";

            // Forzamos el reinicio en Tiempo 0 independiente por cada calibre seleccionado
            for (const idDil in gruposPorDilatacion) {
                const miccionesDeEstaSonda = gruposPorDilatacion[idDil].sort((a, b) => {
                    return parsearFechaCompletaDI(a.fecha) - parsearFechaCompletaDI(b.fecha);
                });

                let tiempoEjeXAcumulado = 0;
                let ultimaFechaDeEsteGrupo = null;
                const puntosDeEstaSonda = [];

                miccionesDeEstaSonda.forEach(item => {
                    const datosMétricaEnPHP = item.calculos ? item.calculos[metricaActivaLimpia] : null;
                    const valorNumericoReal = datosMétricaEnPHP ? Number(datosMétricaEnPHP.valor.toString().replace(/,/g, '') || 0) : 0;
                    
                    if (datosMétricaEnPHP && datosMétricaEnPHP.nombre) {
                        nombreEjeY = datosMétricaEnPHP.nombre;
                        unidadEjeY = datosMétricaEnPHP.unidad || "";
                    }

                    const fechaActual = parsearFechaCompletaDI(item.fecha);

                    if (ultimaFechaDeEsteGrupo === null) {
                        tiempoEjeXAcumulado = 0; // Origen Relativo Estricto en el Día 0
                    } else if (fechaActual.getTime() > 0) {
                        const diferenciaMilisegundos = fechaActual.getTime() - ultimaFechaDeEsteGrupo.getTime();
                        const diasDeDiferencia = diferenciaMilisegundos / (1000 * 60 * 60 * 24);
                        
                        // Candado de 7 días: si hay abandono, salta un solo día virtual
                        tiempoEjeXAcumulado += (diasDeDiferencia > 7) ? 1 : diasDeDiferencia;
                    }

                    if (fechaActual.getTime() > 0) {
                        // CORREGIDO: Usamos el nombre exacto de la variable de control de este grupo
                        ultimaFechaDeEsteGrupo = fechaActual; 
                    }

                    const punto = { x: tiempoEjeXAcumulado, y: valorNumericoReal };
                    puntosDeEstaSonda.push(punto);
                    todosLosPuntosSuperpuestos.push(punto);
                });

                const idMadreNum = Number(idDil);
				const primerRegistroDeSonda = gruposPorDilatacion[idDil][0];
            
                datasetsSuperposicion.push({
                    label: `Dilatación ${idDil}: ${miccionesDeEstaSonda[0].frSonda}Fr: `,
                    data: puntosDeEstaSonda,
                
                    borderColor: UroMxApp.getColor(idMadreNum, true), 
                    borderWidth: UroMxApp.constants.CurvaMDelgada || 0.75, // Trazo fino CurvaMDelgada
                    showLine: true,
                    spanGaps: false, 
                    tension: 0.15,
                    pointRadius: 0,
                    pointHoverRadius: 4,
					El_Criterio: 'idDilatacion',
					El_Y_Valor: Math.floor(Number(idDil))             
                
                });
            }

            // --- RECOLECTOR DE LÍNEAS DE TENDENCIA (MINIMOS CUADRADOS) AL FONDO ---
            if (UroMxApp.state.botonClinicoActivo && todosLosPuntosSuperpuestos.length > 1) {
                const calcularRegresionLineal = (puntos) => {
                    const n = puntos.length; if (n < 2) return null;
                    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                    puntos.forEach(p => { sumX += p.x; sumY += p.y; sumXY += (p.x * p.y); sumXX += (p.x * p.x); });
                    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    const b = (sumY - m * sumX) / n;
                    return { m: isNaN(m) ? 0 : m, b: isNaN(b) ? 0 : b };
                };

                // A) Tendencias individuales por sección (Rojo 0.5)
                for (const idMadre in gruposPorDilatacion) {
                    const puntosSonda = datasetsSuperposicion.find(ds => ds.label === `Estudio Dil ${idMadre}`)?.data || [];
                    const rectaIndividual = calcularRegresionLineal(puntosSonda);
                    if (rectaIndividual && puntosSonda.length > 1) {
                        const xMin = puntosSonda[0].x; const xMax = puntosSonda[puntosSonda.length - 1].x;
                        datasetsSuperposicion.unshift({
                            label: `Tend 1364 encia Dil ${idMadre}`,
                            data: [{ x: xMin, y: rectaIndividual.m * xMin + rectaIndividual.b }, { x: xMax, y: rectaIndividual.m * xMax + rectaIndividual.b }],
                            borderColor: 'rgba(255, 0, 0, 0.5)', borderWidth: 1.5, showLine: true, pointRadius: 0, fill: false,
                        El_Criterio: 'idDia',
                        El_Y_Valor: Math.floor(Number(mId))                        
                        });
                    }
                }

                // B) Tendencia General Acumulada (Rojo Oscuro 0.75)
                const rectaGeneral = calcularRegresionLineal(todosLosPuntosSuperpuestos);
                if (rectaGeneral) {
                    const puntosOrdenadosX = [...todosLosPuntosSuperpuestos].sort((a, b) => a.x - b.x);
                    const xMinGlobal = puntosOrdenadosX[0].x; const xMaxGlobal = puntosOrdenadosX[puntosOrdenadosX.length - 1].x;
                    datasetsSuperposicion.unshift({
                        label: 'Tendencia General DI',
                        data: [{ x: xMinGlobal, y: rectaGeneral.m * xMinGlobal + rectaGeneral.b }, { x: xMaxGlobal, y: rectaGeneral.m * xMaxGlobal + rectaGeneral.b }],
                        borderColor: 'rgba(139, 0, 0, 0.75)', borderWidth: 2.5, showLine: true, pointRadius: 0, fill: false
                    });
                }
            }

            this.buildAndDrawCanvasEvolutivo(canvas, datasetsSuperposicion, nombreEjeY, unidadEjeY);
            return; 
        }

        // =========================================================================
        // --- COMPUERTA CLÍNICA UNIVERSAL SECUENCIAL BLINDADA (MÓDULO 5) [STEM] ---
        // =========================================================================
        const botonClinicoActivo = UroMxApp.state.botonClinicoActivo;

        if (botonClinicoActivo) {
            const datasetsSecuencialesUro = [];
            
            // SUBFUNCIÓN INTERNA DE CONVERSIÓN CRONOLÓGICA INQUEBRANTABLE [STEM]
            const parsearFechaClinicaCompleta = (strFechaHora) => {
                if (!strFechaHora || !strFechaHora.includes(' ')) return new Date(0);
                const partesEspacio = strFechaHora.split(' '); // ['dd/mm/yyyy', 'HH:MM']
                const componentesFecha = partesEspacio[0].split('/'); // ['dd', 'mm', 'yyyy']
                const componentesHora = partesEspacio[1].split(':');  // ['HH', 'MM']
                return new Date(
                    Number(componentesFecha[2]),       // Año (yyyy)
                    Number(componentesFecha[1]) - 1,   // Mes (0-11)
                    Number(componentesFecha[0]),       // Día (dd)
                    Number(componentesHora[0] || 0),   // Hora (HH)
                    Number(componentesHora[1] || 0)    // Minuto (MM)
                );
            };

            // ORDENAMIENTO EN MATRIZ DE ALTA RESOLUCIÓN: Forzamos el orden estricto contra firmas retorcidas
            const miccionesOrdenadasTiempo = [...UroMxApp.state.domFiltrado].sort((a, b) => {
                return parsearFechaClinicaCompleta(a.fecha) - parsearFechaClinicaCompleta(b.fecha);
            });

            let ejeXVirtualConsecutivo = 0;
            let ultimaEstampaTiempo = null;
            const puntosLineaContinuaMaestra = [];
            
            const madresON = Array.from(UroMxApp.state.selectedMothers);
            const hijosON = Array.from(UroMxApp.state.selectedChildren);

            // A) PRE-CONTEO DE ACUPUNTURA: Evaluamos de antemano cuántos registros pasarían el filtro tradicional
            let conteoRegistrosFiltradosInicial = 0;
            miccionesOrdenadasTiempo.forEach(item => {
                const idM = Math.floor(Number(UroMxApp.state.mode === 'MX' ? item.idDia : item.idDilatacion));
                const idX = Number(item.idMix);
                const idD = Math.floor(Number(item.idDia));
                
                if (UroMxApp.state.mode === 'MX') {
                    if (hijosON.length > 0 && UroMxApp.state.selectedChildren.has(idX)) conteoRegistrosFiltradosInicial++;
                    else if (madresON.length > 0 && hijosON.length === 0 && UroMxApp.state.selectedMothers.has(idM)) conteoRegistrosFiltradosInicial++;
                } else {
                    if (hijosON.length > 0 && UroMxApp.state.selectedChildren.has(idD)) conteoRegistrosFiltradosInicial++;
                    else if (madresON.length > 0 && hijosON.length === 0 && UroMxApp.state.selectedMothers.has(idM)) conteoRegistrosFiltradosInicial++;
                }
            });

            // REGLA DE ACUPUNTURA: Si quedan solo 1 o 2 micciones, se activa el forzado automático del Historial Completo
            const forzarHistorialPorFaltaDeDatos = (conteoRegistrosFiltradosInicial > 0 && conteoRegistrosFiltradosInicial <= 2);

            // B) BARRIDO MAESTRO DEL DOM CON LA REGLA APLICADA
            miccionesOrdenadasTiempo.forEach(item => {
                const idMadreItem = Math.floor(Number(UroMxApp.state.mode === 'MX' ? item.idDia : item.idDilatacion));
                const idMixItem = Number(item.idMix);
                const idDiaItem = Math.floor(Number(item.idDia));

                let pasaElFiltroClinico = false;

                // --- EVALUACIÓN DE TUS 3 AMBIENTES DE AMBIENTE UX ---
                if (UroMxApp.state.mode === 'MX') {
                    // REGLA RECTIFICADA: Si se activa el forzado por falta de datos, se brinca al Ambiente A de golpe
                    if (forzarHistorialPorFaltaDeDatos || UroMxApp.state.mostrarPromedioGlobalGris || (!UroMxApp.state.mostrarPromedioKinderGris && madresON.length === 0 && hijosON.length === 0)) {
                        pasaElFiltroClinico = true; // Historial Completo (Ambiente A)
                    } else if (madresON.length > 0 && hijosON.length === 0) {
                        pasaElFiltroClinico = UroMxApp.state.selectedMothers.has(idMadreItem);
                    } else if (hijosON.length > 0) {
                        pasaElFiltroClinico = UroMxApp.state.selectedChildren.has(idMixItem);
                    }
                } else {
                    if (forzarHistorialPorFaltaDeDatos || UroMxApp.state.mostrarPromedioGlobalGris || (!UroMxApp.state.mostrarPromedioKinderGris && madresON.length === 0 && hijosON.length === 0)) {
                        pasaElFiltroClinico = true;
                    } else if (madresON.length > 0 && hijosON.length === 0) {
                        pasaElFiltroClinico = UroMxApp.state.selectedMothers.has(idMadreItem);
                    } else if (hijosON.length > 0) {
                        pasaElFiltroClinico = UroMxApp.state.selectedChildren.has(idDiaItem);
                    }
                }

                if (pasaElFiltroClinico) {
                    const datosMétricaEnPHP = item.calculos ? item.calculos[botonClinicoActivo] : null;
                    const valorNumericoReal = datosMétricaEnPHP ? Number(datosMétricaEnPHP.valor.toString().replace(/,/g, '') || 0) : 0;
                    
                    if (datosMétricaEnPHP && datosMétricaEnPHP.nombre) {
                        nombreEjeY = datosMétricaEnPHP.nombre;
                        unidadEjeY = datosMétricaEnPHP.unidad || "";
                    }

                    const fechaActual = parsearFechaClinicaCompleta(item.fecha);

                    if (ultimaEstampaTiempo && fechaActual.getTime() > 0) {
                        const diferenciaDias = (fechaActual.getTime() - ultimaEstampaTiempo.getTime()) / (1000 * 60 * 60 * 24);
                        if (diferenciaDias > 7) {
                            ejeXVirtualConsecutivo += 1; // Brinco visual de abandono de tratamiento
                        } else if (diferenciaDias > 0) {
                            ejeXVirtualConsecutivo += diferenciaDias; // Avance continuo horario exacto
                        }
                    }
                    if (fechaActual.getTime() > 0) ultimaEstampaTiempo = fechaActual;

                    // Determinamos las llaves genéticas para los tramos
                    let criterioIdentidad = UroMxApp.state.mode === 'MX' ? 'idDia' : 'idDilatacion';
                    let valorIdentidadNum = idMadreItem;

                    if (UroMxApp.state.mode === 'MX' && (hijosON.length > 0 || UroMxApp.state.mostrarPromedioKinderGris)) {
                        criterioIdentidad = 'idMix';
                        valorIdentidadNum = idMixItem;
                    } else if (UroMxApp.state.mode === 'DI' && (hijosON.length > 0 || UroMxApp.state.mostrarPromedioKinderGris)) {
                        criterioIdentidad = 'idDia';
                        valorIdentidadNum = idDiaItem;
                    }

                    const partesTexto = item.fecha.split(' ');
                    puntosLineaContinuaMaestra.push({
                        x: ejeXVirtualConsecutivo,
                        y: valorNumericoReal,
                        idColorTramo: valorIdentidadNum,
                        fechaLabel: `${partesTexto[0].substring(0, 5)} ${partesTexto[1] || ''}`,
                        El_Criterio: criterioIdentidad,
                        El_Y_Valor: valorIdentidadNum
                    });
                }
            });

            // SERIE MAESTRA EVOLUTIVA 
            datasetsSecuencialesUro.push({
                label: nombreEjeY,
                data: puntosLineaContinuaMaestra,
                borderWidth: UroMxApp.constants.CurvaBoton || 0.5, 
                showLine: true,
                spanGaps: false,
                tension: 0.15,
                pointRadius: 0, // TOTALMENTE FUMIGADAS
                pointHoverRadius: 5,
                segment: {
                    borderColor: ctx => {
                        const pt = ctx.p0.raw;
                        const idColor = pt ? pt.idColorTramo : 0;
                        return UroMxApp.getColor(idColor, true); // Aplica el color sólido correspondiente
                    }
                },
                El_Criterio: UroMxApp.state.mode === 'MX' ? (hijosON.length > 0 ? 'idMix' : 'idDia') : (hijosON.length > 0 ? 'idDia' : 'idDilatacion'),
                El_Y_Valor: 'HISTORIAL_EVOLUTIVO_SECUENCIAL'
            });

            this.buildAndDrawCanvasEvolutivo(canvas, datasetsSecuencialesUro, nombreEjeY, unidadEjeY);
            return; 
        }

   

        // --- MOTOR DE DIBUJO DE CURVAS DE COLORES CON JERARQUÍA SIMÉTRICA ---
        if (UroMxApp.state.mostrarCurvasHijosEnGrafica) {

            if (UroMxApp.state.mode === 'MX') {
                // MODO MICCIÓN (MX): Las curvas individuales de fondo son micciones sueltas (item.idMix)
                UroMxApp.state.domFiltrado.forEach(item => {
                    const idMadreReal = Math.floor(Number(item.idDia));
                    if (UroMxApp.state.selectedChildren.has(item.idMix)) {
                        datasets.push({
                            label: `Micción: ${item.fecha}`,  //OKlabel: MX-HIJO-ON
                            data: (item.flujo_mls || []).map((f, i) => ({ x: i, y: f })),
                            borderColor: UroMxApp.getColor(item.idMix, true), 
                            borderWidth: UroMxApp.constants.CurvaHGruesa, // 1.5
                            showLine: true,
                            tension: 0.41,
                            pointRadius: 0,
                            pointHoverRadius: 0,
	                        scales: { x: { title: { display: true, text: 'Tiempo [s]'}}, y: { title: { display: true, text: 'Volumen [mL]'}}},
                            El_Criterio: 'idMix', //MX-HI
                            El_Y_Valor: Number(item.idMix)                        
                        });
                    } 
                    else if (UroMxApp.state.selectedMothers.has(idMadreReal)) {
                            datasets.push({
                            label: `Micción: ${item.fecha}`,  //OKlabel: MX-HIJO-ON
                            data: (item.flujo_mls || []).map((f, i) => ({ x: i, y: f })),
                            borderColor: UroMxApp.getColor(item.idMix, false), 
                            borderWidth: UroMxApp.constants.CurvaHDelgada, // 0.75
                            showLine: true,
                            tension: 0.42,
                            pointRadius: 0,
                            pointHoverRadius: 0,
							scales: { x: { title: { display: true, text: 'Tiempo [s]'}}, y: { title: { display: true, text: 'Volumen [mL]'}}},
                            El_Criterio: 'idMix',
                            El_Y_Valor: Number(item.idMix)                            
                        
                        });
                    }
                });
            } 
            else {
                // MODO DILATACIÓN (DI): Los hijos son los DÍAS HERMANOS
                const diasProcesadosEnGrafica = new Set();
                UroMxApp.state.domFiltrado.forEach(item => {
                    const idMadreReal = Math.floor(Number(item.idDilatacion));
                    const idDiaHermano = Math.floor(Number(item.idDia));
                    const idDiaStr = idDiaHermano.toString();

                    if (UroMxApp.state.selectedMothers.has(idMadreReal) && !diasProcesadosEnGrafica.has(idDiaStr)) {
                        diasProcesadosEnGrafica.add(idDiaStr);
                        const datosPromedioDia = UroMxApp.state.cachedAverages.porDia[idDiaStr];
                        if (datosPromedioDia) {
                            if (UroMxApp.state.selectedChildren.has(idDiaHermano)) {
                                datasets.push({
                                    label: `Micciones del ${item.fecha.substring(0,10)}`,  //labelOK 
                                    data: datosPromedioDia.curva.map((f, i) => ({ x: i, y: f })),
                                    borderColor: UroMxApp.getColor(idDiaHermano, true), // Color Sólido Intenso
                                    borderWidth: UroMxApp.constants.CurvaHGruesa, // Grosor Hijo Gruesa 1.5
                                    showLine: true,
                                    tension: 0.4,
                                    pointRadius: 0,
                                    pointHoverRadius: 0,
                        			El_Criterio: 'idDia', //DI-HI
                        			El_Y_Valor: Math.floor(Number(idDiaHermano))
                                
                                });
                            } 
                            // CONDICIÓN B: Si no está seleccionado individualmente, se queda de fondo -> PASTEL
                            else {
                                datasets.push({
                                    label: `Micciones del ${item.fecha.substring(0,10)}`,  //OKLabel
                                    data: datosPromedioDia.curva.map((f, i) => ({ x: i, y: f })),
                                    borderColor: UroMxApp.getColor(idDiaHermano, false), // Color Pastel Suave
                                    borderWidth: UroMxApp.constants.CurvaHDelgada, // Grosor Hijo Delgada 0.75
                                    showLine: true,
                                    tension: 0.4,
                                    pointRadius: 0,
                                    pointHoverRadius: 0,
                                	scales: { x: { title: { display: true, text: 'Tiempo [s]'}}, y: { title: { display: true, text: 'Volumen [mL]'}}},
        			                El_Criterio: 'idDia',
		            	            El_Y_Valor: Math.floor(Number(idDiaHermano)) // DI-MA
                                
                                });
                            }
                        }
                    }
                });
            }
        }

        // REGLA PROMPT: Graficar la curva del promedio consolidado de las madres seleccionadas (Grosor 3)
         UroMxApp.state.selectedMothers.forEach(mId => {
            // Contexto inteligente de caché: porDia en Modo MX y porDilatacion en Modo DI
            const cacheContext = UroMxApp.state.mode === 'MX' ? UroMxApp.state.cachedAverages.porDia : UroMxApp.state.cachedAverages.porDilatacion;
            const promMadre = cacheContext[mId.toString()];

            if (promMadre) {
                // Buscamos el registro correspondiente para extraer el texto de la estampa cronológica
                const registroDia = UroMxApp.state.domFiltrado.find(item => {
                    const idEvaluar = UroMxApp.state.mode === 'MX' ? item.idDia : item.idDilatacion;
                    return Math.floor(Number(idEvaluar)) === mId;
                });
                
                // Si es Modo MX muestra la fecha de 10 dígitos; si es Modo DI muestra el calibre de la sonda
                const etiquetaIdentidad = UroMxApp.state.mode === 'MX' 
                    ? (registroDia ? registroDia.fecha.substring(0, 10) : mId)
                    : `${mId}: sonda #${registroDia?.frSonda || ''}Fr`;
            
                datasets.push({
                    // Etiqueta dinámica de alta definición para el médico
                    label: UroMxApp.state.mode === 'MX' ? `Micciones del ${etiquetaIdentidad}` : `Dilatación ${etiquetaIdentidad}`,  //OKLabel
                    data: promMadre.curva.map((f, i) => ({ x: i, y: f })),
                    borderColor: UroMxApp.getColor(mId, true),       
                    borderWidth: UroMxApp.constants.CurvaMGruesa || 3, 
                    showLine: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 0,                    
                    
                    // --- REGLA MÁSTER: EL PASAPORTE GENÍTICO MUTANTE SEGÚN EL MODO [STEM] ---
                    El_Criterio: UroMxApp.state.mode === 'MX' ? 'idDia' : 'idDilatacion',
                    El_Y_Valor: Math.floor(Number(mId))                
                });
            }
        });
    // 1. CONTROL DE RE-ESCALADO: Liberamos temporalmente las opciones rígidas para erradicar el bucle infinito de zoom
    if (this.chartFlujo && this.chartFlujo.options.scales && this.chartFlujo.options.scales.x) {
        // Permitimos que la rejilla respire de forma nativa antes del update para que no achaparre tus 28 tarjetas
        this.chartFlujo.options.scales.x.min = UroMxApp.state.mode === 'MX' ? 0 : -1;
        delete this.chartFlujo.options.scales.x.max;
        delete this.chartFlujo.options.scales.y.min;
        delete this.chartFlujo.options.scales.y.max;
    }

    // 2. FILTRO DE AISLAMIENTO CLÍNICO MEDIANTE ATRIBUTO HIDDEN INDESTRUCTIBLE [DESCARGAR_PLUGINS_CDN]
    if (UroMxApp.state.modoDiagnosticoActivo && UroMxApp.state.lastContext && this.chartFlujo) {
        const idAislado = Math.floor(Number(UroMxApp.state.lastContext.id));
        const tipoAislado = UroMxApp.state.lastContext.contexto;

        this.chartFlujo.data.datasets.forEach(dataset => {
            let esLaCurvaElegida = false;
            if (tipoAislado === 'MADRE') {
                esLaCurvaElegida = (dataset.El_Criterio === 'idDia' || dataset.El_Criterio === 'idDilatacion') && Math.floor(Number(dataset.El_Y_Valor)) === idAislado;
            } else {
                esLaCurvaElegida = (dataset.El_Criterio === 'idMix') && Number(dataset.El_Y_Valor) === idAislado;
            }

            // Si es la elegida la dejamos reluciente, a todas las demás competidoras las apagamos de forma nativa [DESCARGAR_PLUGINS_CDN]
            dataset.hidden = !esLaCurvaElegida;
        });
    } else if (this.chartFlujo) {
        // Si no estamos en modo diagnóstico, aseguramos que todas las curvas recuperen su visibilidad en combo
        this.chartFlujo.data.datasets.forEach(dataset => {
            dataset.hidden = false;
        });
    }
    
        this.buildAndDrawCanvas(canvas, datasets);
    },

    // 2. CONSTRUCTOR COMPACTO DE LA INSTANCIA DE CHART.JS (CORREGIDO LEYENDAS) PRIMERO
    buildAndDrawCanvas: function(canvas, datasets) { 
        if (this.chartFlujo) this.chartFlujo.destroy();
  
        
        this.chartFlujo = new Chart(canvas, {
            type: 'scatter',
            data: { datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                
                // --- CORREGIDO: RADIO DE ACCIÓN LIMITADO PARA NO BUSCAR A KILÓMETROS ---
//				scales: { x: { title: { display: true, text: 'Tiempo [s]', padding: 0}}, y: { title: { display: true, text: 'Volumen [mL]'}}},


				scales: { x: { type: 'linear', position: 'bottom', offset: false, grace: 0, ticks: { padding: 0, callback: function(value) { return value >= 0 ? (value / 10).toFixed(0) : ''; }, stepSize: 10 }, title: { display: true, text: 'Tiempo [s]', padding: 0 } }, y: { type: 'linear', offset: false, grace: 0, title: { display: true, text: 'Volumen [mL]' } } },


            
            	interaction: {
                    mode: 'nearest',
                    intersect: false,
                    axis: 'xy',
                    radius: 10 // Tolerancia máxima de 20 píxeles a la redonda
                },                // DESACTIVAMOS EL TOOLTIP NEGRO ORIGINAL DE CHART.JS
                plugins: { 
                    legend: { 
                        display: true, // Se mantiene encendida la leyenda general
                        labels: {
                            // REGLA SOLICITADA: Filtro inteligente para ocultar micciones individuales
                            filter: function(item) {
                                // Solo se permite mostrar las leyendas de tus 2 curvas fijas
                                return item.text === 'Promedio histórico' || 
                                       item.text === 'Promedio micciones días seleccionados';
                            }
                        }
                    },
                    tooltip: { enabled: false }, // Apaga el cuadro negro intrusivo
                    zoom: { pan: { enabled: true, mode: 'xy', modifierKey: 'ctrl' }, zoom: { drag: { enabled: true, backgroundColor: 'rgba(0,102,204,0.15)', borderColor: '#0066cc', borderWidth: 1 }, pinch: { enabled: true }, mode: 'xy' } }
                
                },

                // --- SENSOR DE VUELO CON CAPTURA DE NOMBRE DE CURVA EN CALIENTE (MÓDULO 5) ---
                onHover: (event, activeElements, chart) => UroMxApp.ChartManager.processGraphHoverFeatures(event, activeElements, chart)
            }
        });

    	this.attachInteractiveGraphControls(canvas);   //CONTROL DE ZOOM, PINCH
    	console.log("UroMx Módulo 5: Gráfica inyectada con leyendas clínicas selectivas.");
    },

    // SUBFUNCIÓN COMPACTA: Dibuja la línea del tiempo inyectando las unidades dinámicas del parser (Módulo 5)
    // SUBFUNCIÓN COMPACTA: Constructor Híbrido Mixto con Fuerza para Líneas de Tendencia (Módulo 5)
    buildAndDrawCanvasEvolutivo: function(canvas, datasets, nombreMetrica, unidadMetrica) {
        if (this.chartFlujo) this.chartFlujo.destroy();
        
        // CORREGIDO: Convertimos cada dataset de tendencia en un objeto de tipo 'line' explícito
        const datasetsCorregidos = datasets.map(ds => {
            // Si el nombre de la serie contiene la palabra 'Tendencia', la forzamos a ser una línea pura
            if (ds.label.includes('Tendencia')) {
                return {
                    ...ds,
                    type: 'line', // Fuerza el renderizado de la raya roja de fondo en Chart.js
                    fill: false,
                    showLine: true,
                    pointRadius: 0, // Sin moscas
                    pointHoverRadius: 0,
                };
            }
            // Las series de las micciones y días se quedan como dispersión normal
            return { ...ds, type: 'scatter' };
        });

        this.chartFlujo = new Chart(canvas, {
            type: 'scatter', // Tipo base del lienzo
            data: { datasets: datasetsCorregidos },
        	options: {
            	responsive: true, maintainAspectRatio: false, animation: false,
                layout: {
                    padding: {
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0 // Cero absoluto: exprime el aire interno en la base del lienzo
                    }
                },                
                // --- CORREGIDO: RADIO DE ACCIÓN LIMITADO PARA NO BUSCAR A KILÓMETROS ---
                interaction: {
                    mode: 'nearest',
                    intersect: false,
                    axis: 'xy',
                    radius: 20 // Tolerancia máxima de 20 píxeles a la redonda
                },
            scales: {
                    x: {
                        type: 'linear', grace: 0, offset: false, position: 'bottom', min: -0.2, suggestedMin: -0.2, bounds: 'ticks',
                        title: { display: true, text: 'Tiempo transcurrido (Días)', padding: 0 },
//                        ticks: { padding: 0, callback: function(value) { return value >= 0 ? Math.floor(value) : ''; }, stepSize: 1 },
                        ticks: { 
                            padding: 0, 
                            // =========================================================================
                            // --- 📍 CONVERSOR FUSIONADO AL RAS DE TUS CONFIGURACIONES [STEM] ---
                            // =========================================================================
                            // Conservamos tu candado de no negativos, pero dividimos el índice entre 10
                            callback: function(value) { 
                                return value >= 0 ? (value / 10).toFixed(1) : ''; 
                            }, 
                            stepSize: 1 
                        },
                        grid: { color: function(context) { if (context.tick.value < 0) return 'transparent'; return context.tick.value % 1 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.03)'; } }
                    },
                    y: { 
                        type: 'linear', grace: 0, offset: false, 
                        title: { display: true, text: unidadMetrica ? `${nombreMetrica} (${unidadMetrica})` : nombreMetrica } 
                    }
                },
                plugins: { 
                	legend: { display: false },
                    tooltip: { enabled: false }, // Apaga el cuadro negro intrusivo
                    zoom: { pan: { enabled: true, mode: 'xy', modifierKey: 'ctrl' }, zoom: { drag: { enabled: true, backgroundColor: 'rgba(0,102,204,0.15)', borderColor: '#0066cc', borderWidth: 1 }, pinch: { enabled: true }, mode: 'xy' } }
                },
                // --- SENSOR DE VUELO CON CAPTURA DE NOMBRE DE CURVA EN CALIENTE (MÓDULO 5) ---
                onHover: (event, activeElements, chart) => UroMxApp.ChartManager.processGraphHoverFeatures(event, activeElements, chart)
            }
        });
        this.attachInteractiveGraphControls(canvas);   //CONTROL DE ZOOM, PINCH
    	console.log(`UroMx Módulo 5: Gráfica híbrida analítica renderizada para -> ${nombreMetrica}`);
    },

    // =========================================================================
    // FUNCIÓN MADRE GLOBAL DE VUELO (ONHOVER), AISLACIÓN Y RECOLECTOR DE PENDIENTES (MÓDULO 5) [STEM]
    // =========================================================================
    processGraphHoverFeatures: function(event, activeElements, chart) {
        const cajaContenido = document.getElementById('uro-tooltip-contenido');
        if (!cajaContenido) return;

        let seEncontroSerieValida = false;

        // 1. REGLA 1 Y 2: SI EL MOUSE ENTRA AL RADIO DE ACCIÓN ACOOTADO (20 PX)
        if (activeElements && activeElements.length > 0) {
            const elementoActivoReal = activeElements[0]; // Capturamos el primer impacto real
            
            if (elementoActivoReal) {
                const indiceDatasetRozado = elementoActivoReal.datasetIndex;
                const indiceElemento = elementoActivoReal.index;
                const serieActiva = chart.data.datasets[indiceDatasetRozado];

                if (serieActiva && serieActiva.data) {
                    seEncontroSerieValida = true;
                    
                    const puntoRaw = serieActiva.data[indiceElemento];
                    const nombreActualDeLaCurva = serieActiva.label || "Curva Clínica";

                    let valorX = (puntoRaw && typeof puntoRaw === 'object') ? (puntoRaw.x ?? indiceElemento) : indiceElemento;
                    let valorY = (puntoRaw && typeof puntoRaw === 'object') ? (puntoRaw.y ?? 0) : (Number(puntoRaw) || 0);
                    let labelFecha = (puntoRaw && typeof puntoRaw === 'object') ? (puntoRaw.fechaLabel || '') : '';
                
                    valorX = Number(valorX) || 0;
                    valorY = Number(valorY) || 0;

                    // =========================================================================
                    // MOTOR EXTRACTOR DE PICO CLÍNICO POR PASAPORTE GENÍTICO (PASO 4 FIN) [STEM]
                    // =========================================================================
                    const criterioActivo = (puntoRaw && typeof puntoRaw === 'object' && puntoRaw.El_Criterio) ? puntoRaw.El_Criterio : (serieActiva.El_Criterio || 'idMix');
                    const valorActivo = (puntoRaw && typeof puntoRaw === 'object' && puntoRaw.El_Y_Valor !== undefined) ? puntoRaw.El_Y_Valor : (serieActiva.El_Y_Valor ?? -1);
                    const criterioDeEstaCurva = (puntoRaw && typeof puntoRaw === 'object' && puntoRaw.El_Criterio) ? puntoRaw.El_Criterio : (serieActiva.El_Criterio || 'idMix');
                    const valorDeEstaCurva = (puntoRaw && typeof puntoRaw === 'object' && puntoRaw.El_Y_Valor !== undefined) ? puntoRaw.El_Y_Valor : (serieActiva.El_Y_Valor ?? -1);
                
                    let sumaTQmax = 0;
                    let conteoRegistrosAsociados = 0;
                    let unidadTiempo = "s";


                    // BARRIDO SELECTIVO CON LA MIRA LÁSER QUE INVENTASTE [STEM]
                    UroMxApp.state.domFiltrado.forEach(item => {
                        let esElRegistroBuscado = false;

                        // CASO A: COMODÍN -1 (TRIPLE CLIC MADRE MX - PROMEDIO HISTÓRICO)
                        if (valorActivo === -1) {
                            esElRegistroBuscado = true; 
                        }
                        // CASO B: TRIPLE CLIC HIJO MX (PROMEDIO DEL KINDER ACTIVO)
                        else if (criterioActivo === 'idDiaSeleccionado') {
                            const idDiaItem = Math.floor(Number(item.idDia));
                            esElRegistroBuscado = Array.isArray(valorActivo) && valorActivo.includes(idDiaItem);
                        }
                        // CASO C: GRÁFICOS DE TARJETA CLÍNICA EVOLUTIVA DI
                        else if (valorActivo === 'EVOLUCION_LINEAL_DI') {
                            esElRegistroBuscado = false; 
                        }
                        // CASO D: FILTRADO ESTÁNDAR POR LLAVE DIRECTA (idMix, idDia, idDilatacion)
                        else if (item[criterioActivo] !== undefined) {
                            const valorCampoDOM = Math.floor(Number(item[criterioActivo]));
                            esElRegistroBuscado = (valorCampoDOM === Math.floor(Number(valorActivo)));
                        }

                        // EXTRACCIÓN CON LA SINTAXIS EXACTA DE TU PARSER DE PHP (tQMax)
                        if (esElRegistroBuscado && item.calculos && item.calculos.tQMax) {
                            const valorLimpio = Number(item.calculos.tQMax.valor.toString().replace(/,/g, '') || 0);
                            sumaTQmax += valorLimpio;
                            conteoRegistrosAsociados++;
                            unidadTiempo = item.calculos.tQMax.unidad || "s";
                        }
                    });

                    // Vestimos el Tooltip reubicable con tu nueva métrica real del DOM
                    const promedioTQmaxFinal = conteoRegistrosAsociados > 0 ? (sumaTQmax / conteoRegistrosAsociados) : valorX;
                
                    if (UroMxApp.InteractionManager && typeof UroMxApp.InteractionManager.triggerLabelBlinkCombo === 'function') {
                        UroMxApp.InteractionManager.triggerLabelBlinkCombo(valorDeEstaCurva, true, criterioDeEstaCurva);
                    }

                    // --- INYECCIÓN QUIRÚRGICA PASO 4: INTERRUPTOR CLÍNICO AVANZADO DUAL ---
                    const botonClinicoActivo = UroMxApp.state.botonClinicoActivo;

                    if (botonClinicoActivo) {
                        // =========================================================================
                        // MODO ENCIENDIDO: ALGORITMO DE TENDENCIAS DUALES SECUENCIALES [STEM]
                        // =========================================================================
                        // --- ACTUALIZADO: TENDENCIAS DUALES CON CANDADO DE CLIP Y VENTANA [STEM] ---
                        const puntos = serieActiva.data;
                        const n = puntos.length;

                        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                        puntos.forEach((p, idx) => {
                            let px = typeof p === 'object' && p !== null ? p.x : idx;
                            let py = typeof p === 'object' && p !== null ? p.y : (Number(p) || 0);
                            sumX += px; sumY += py; sumXY += (px * py); sumXX += (px * px);
                        });
                        const mGeneral = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                        const bGeneral = (sumY - mGeneral * sumX) / n;
                        const mGenCalculada = isNaN(mGeneral) ? 0 : mGeneral;
                        
                        const valorTendenciaGeneralEnPunto = mGenCalculada * valorX + bGeneral;

                        // --- CÁLCULO DEL ÁNGULO DE LA TENDENCIA GENERAL EN GRADOS [STEM] ---
                        const anguloGeneralGrados = Math.atan(mGenCalculada) * (180 / Math.PI);

                        // =========================================================================
                        // B) CÁLCULO DE TENDENCIA PUNTUAL (VECINDARIO INTERNO DE 5 MICCIONES) [STEM]
                        // =========================================================================
                        // CORREGIDO: En lugar de días abstractos, filtramos estrictamente por proximidad de índices en el arreglo
                        const rangoVecindadIndices = 2; // Captura 2 micciones al pasado y 2 al futuro
                        const inicioVentanaIdx = Math.max(0, indiceElemento - rangoVecindadIndices);
                        const finVentanaIdx = Math.min(puntos.length - 1, indiceElemento + rangoVecindadIndices);

                        const ventanaPuntosPuntuales = puntos.slice(inicioVentanaIdx, finVentanaIdx + 1);

                        let mPuntualCalculada = mGenCalculada;
                        let bPuntualCalculada = bGeneral;

                        if (ventanaPuntosPuntuales.length > 1) {
                            let sX = 0, sY = 0, sXY = 0, sXX = 0;
                            ventanaPuntosPuntuales.forEach((p, idxLocal) => {
                                // Determinamos las coordenadas reales de las micciones vecinas
                                // Usamos el índice global absoluto del punto en la serie para que coincida con el eje X [STEM]
                                let idxGlobalAbsoluto = inicioVentanaIdx + idxLocal;
                                let px = typeof p === 'object' && p !== null ? p.x : idxGlobalAbsoluto;
                                let py = typeof p === 'object' && p !== null ? p.y : (Number(p) || 0);
                                
                                sX += px; sY += py; sXY += (px * py); sXX += (px * px);
                            });

                            const mP = (ventanaPuntosPuntuales.length * sXY - sX * sY) / (ventanaPuntosPuntuales.length * sXX - sX * sX);
                            mPuntualCalculada = isNaN(mP) ? mGenCalculada : mP;
                            
                            // 📍 PIVOTE VERTICAL EXCLUSIVO: Forzamos el cruce exacto en la coordenada (valorX, valorY) del pointhover [STEM]
                            bPuntualCalculada = valorY - (mPuntualCalculada * valorX);
                        } else {
                            bPuntualCalculada = valorY - (mGenCalculada * valorX);
                        }

                        const valorTendenciaPuntualEnPunto = mPuntualCalculada * valorX + bPuntualCalculada;

                        // --- CÁLCULO DEL ÁNGULO DE LA TENDENCIA PUNTUAL EN GRADOS ---
                        const anguloPuntualGrados = Math.atan(mPuntualCalculada * 1.5) * (180 / Math.PI); // Ajustado al factor de aspecto visual

                        const xMinGlobal = puntos?.x || 0;
                        const xMaxGlobal = puntos[puntos.length - 1]?.x || (puntos.length - 1);
                        
                        // Reducimos el ancho visual de la micro-raya negra para que sea un testigo corto y elegante (el equivalente a 2 puntos)
                        const deltaPuntual = Math.min(1.0, (xMaxGlobal - xMinGlobal) * 0.08);
                        const xMinPuntual = Math.max(xMinGlobal, valorX - deltaPuntual);
                        const xMaxPuntual = Math.min(xMaxGlobal, valorX + deltaPuntual);

                        cajaContenido.innerHTML = `
                            <div style="font-weight:bold; color:#0056b3; margin-bottom:4px; font-size:12px; border-bottom:1px dashed #eee; padding-bottom:2px;">
                                ${nombreActualDeLaCurva}
                            </div>
                            <b>Tendencia general:</b> ${anguloGeneralGrados.toFixed(1)}°<br><br>
                            <b>${nombreActualDeLaCurva}:</b> ${valorY.toFixed(2)}<br>
                            <b>Dia:</b> ${valorX.toFixed(2)}<br>
                            <b>Tendencia puntual:</b> ${anguloPuntualGrados.toFixed(1)}°
                        `;


                        // =========================================================================
                        // --- 📍 INYECCIÓN DE ANOTACIONES CON COCHÓN DE CLIP Y GROSOR 1.000 ---
                        // =========================================================================
                        chart.options.plugins.annotation = {
                            annotations: {
                                lineaTendenciaGeneral: {
                                    type: 'line', 
                                    xMin: xMinGlobal, 
                                    xMax: xMaxGlobal,
                                    yMin: mGenCalculada * xMinGlobal + bGeneral, 
                                    yMax: mGenCalculada * xMaxGlobal + bGeneral,
                                    borderColor: 'rgba(220, 53, 69, 0.85)', 
                                    borderWidth: 0.750, // LINEA TENDENCIA
                                    clip: true, 
                                    label: { display: false }
                                },
                                lineaTendenciaPuntual: {
                                    type: 'line', 
                                    xMin: xMinPuntual, 
                                    xMax: xMaxPuntual,
                                    // La altura Y se recalcula usando el modelo local garantizando el cruce perfecto [STEM]
                                    // =========================================================================
                                    // --- 📍 BLINDAJE NUMÉRICO TRUNCADO ANTISALTOS (MÓDULO 5) [STEM] ---
                                    // =========================================================================
                                    // Extraemos el techo y piso real de los datos del lienzo para que la matemática no se dispare al infinito
                                    yMin: (() => {
                                        const yCalculado = mPuntualCalculada * xMinPuntual + bPuntualCalculada;
                                        const limiteInferior = chart.scales.y.min ?? 0;
                                        const limiteSuperior = chart.scales.y.max ?? 100;
                                        // Math.max y Math.min actúan como un embudo que encajona el valor en el rango seguro [STEM]
                                        return Math.max(limiteInferior, Math.min(limiteSuperior, yCalculado));
                                    })(),
                                    
                                    yMax: (() => {
                                        const yCalculado = mPuntualCalculada * xMaxPuntual + bPuntualCalculada;
                                        const limiteInferior = chart.scales.y.min ?? 0;
                                        const limiteSuperior = chart.scales.y.max ?? 100;
                                        return Math.max(limiteInferior, Math.min(limiteSuperior, yCalculado));
                                    })(),
                                    borderColor: '#000000', 
                                    borderWidth: 0.750, // LINEA TENDENCIA
                                    clip: true, 
                                    label: { display: false }
                                }
                            }
                        };
                    } else {
                        // MODO APAGADO (TU LÓGICA TRADICIONAL INTACTA) 
                        cajaContenido.innerHTML = `
                            <div style="font-weight:bold; color:#0056b3; margin-bottom:4px; font-size:12px; border-bottom:1px dashed #eee; padding-bottom:2px;">
                                ${nombreActualDeLaCurva}
                            </div>
                            <b>Tiempo:</b> ${valorX.toFixed(2)/10}s<br>
                            <b>Volumen:</b> ${valorY.toFixed(2)}mL<br>
                            ${labelFecha ? `<b>Fecha:</b> ${labelFecha}` : ''}
                            <br><span style="color:#dc3545; font-weight:bold;">Tiempo Qmax: ${promedioTQmaxFinal.toFixed(3)} ${unidadTiempo}</span>
                        `;

                        chart.options.plugins.annotation = {
                            annotations: {
                                lineaTendenciaVivo: {
                                    type: 'line', mode: 'vertical', scaleID: 'x',
                                    value: promedioTQmaxFinal,
                                    borderColor: '#dc3545', borderWidth: 1.5, label: { display: false }
                                }
                            }
                        };
                    }

                    // --- REGLA 2 CORREGIDA: SE DUPLICA EL GROSOR SÓLO SI NO HAY BOTÓN CLÍNICO ACTIVO --- resaltar curvas mouse
                    // --- 📍 INCISIÓN A: DUPLICADOR DE ACTIVA Y REDUCTOR DE PASIVAS A LA MITAD (MÓDULO 5) [STEM] ---
                    chart.data.datasets.forEach((dataset, idx) => {
                        // Capturamos y respaldamos de forma segura el grosor predeterminado de nacimiento si no existe
                        if (!dataset.borderWidthOriginalBackup) {
                            dataset.borderWidthOriginalBackup = dataset.borderWidth || 0.75;
                        }

                        if (idx === indiceDatasetRozado) {
                            if (botonClinicoActivo) {
                                // REGLA NATIVA: En modo botón clínico se queda INTACTA en su grosor de control de 1.210
                                dataset.borderWidth = dataset.borderWidthOriginalBackup; 
                            } else {
                                // En el modo tradicional de segundos, duplica estrictamente su grosor original (× 2)
                                dataset.borderWidth = dataset.borderWidthOriginalBackup * 2; 
                            }
                        } else {
                            // REGLA SOLICITADA: Todo el resto de las curvas vecinas reducen su grosor original a la mitad exacta [STEM]
                            dataset.borderWidth = dataset.borderWidthOriginalBackup / 2;
                        }
                    });
                    chart.update('none'); // Refresco visual instantáneo sin barridos de animación

                }
            }
        }

    
        // --- REGLA 3: REGRESO A LA NORMALIDAD ABSOLUTA AL ABANDONAR LA CURVA ---
         if (!seEncontroSerieValida) {
            let huboCambio = false;

            // Silbatazo explícito al InteractionManager para que limpie la pantalla de inmediato
            if (UroMxApp.InteractionManager && typeof UroMxApp.InteractionManager.triggerLabelBlinkCombo === 'function') {
                UroMxApp.InteractionManager.triggerLabelBlinkCombo(null, false);
            }

            // Borramos de forma limpia cualquier objeto de anotación que esté activo en el lienzo
            if (chart.options.plugins.annotation && chart.options.plugins.annotation.annotations) {
                chart.options.plugins.annotation.annotations = {};
                huboCambio = true;
            }
       
            // Borramos la línea vertical roja de anotación al retirar el puntero
            if (chart.options.plugins.annotation?.annotations?.lineaTendenciaVivo) {
                delete chart.options.plugins.annotation.annotations.lineaTendenciaVivo;
                huboCambio = true;
            }

            // Restauramos a todos los datasets sus grosores predeterminados de nacimiento
            chart.data.datasets.forEach(dataset => {
                if (dataset.borderWidthOriginalBackup) {
                    huboCambio = true;
                    dataset.borderWidth = dataset.borderWidthOriginalBackup; // Regresa al origen exacto
                    delete dataset.borderWidthOriginalBackup;
                }
            });
            
            if (huboCambio) chart.update('none');
        }

        // --- MIRA TELESCÓPICA INTERNA (CROSSHAIRS EN GROSOR 0.2) ---
        const ctx = chart.ctx;
        const areaGrafico = chart.chartArea;
        const mouseX = event.x;
        const mouseY = event.y;

        if (mouseX >= areaGrafico.left && mouseX <= areaGrafico.right && mouseY >= areaGrafico.top && mouseY <= areaGrafico.bottom) {
            chart.draw(); 
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 0.2; 
            ctx.strokeStyle = '#000000';
            ctx.moveTo(areaGrafico.left, mouseY); ctx.lineTo(areaGrafico.right, mouseY);
            ctx.moveTo(mouseX, areaGrafico.top); ctx.lineTo(mouseX, areaGrafico.bottom);
            ctx.stroke();
            ctx.restore();
        }
    },

// =========================================================================
// --- 📍 MOTOR SIMPLIFICADO DE PRE-VISUALIZACIÓN CLÍNICA (MÓDULO 5) [STEM] ---
// =========================================================================
    injectTemporaryHoverCurve: function(tipo, idBuscado) {
        const GraficoDiagnostico = this.chartFlujo;
        if (!GraficoDiagnostico) return;

        const idEntero = Math.floor(Number(idBuscado));
        let puntosEspejo = [];
        let etiquetaNombre = "";
        let colorLinea = UroMxApp.getColor(idEntero, true);

        // 1. REGLA: Extraemos el vector de promedios de la caché o el DOM según el Modo activo
        if (UroMxApp.state.mode === 'MX') {
            if (tipo === 'MADRE') {
                const dataCachéDia = UroMxApp.state.cachedAverages?.porDia?.[idEntero.toString()];
                if (dataCachéDia && dataCachéDia.curva) {
                    puntosEspejo = dataCachéDia.curva.map((f, i) => ({ x: i, y: f }));
                    etiquetaNombre = `Pre-visualización Promedio Día ${idEntero}`;
                }
            } else {
                const regHijo = UroMxApp.state.domFiltrado.find(item => Number(item.idMix) === idEntero);
                if (regHijo && regHijo.flujo_mls) {
                    puntosEspejo = regHijo.flujo_mls.map((f, i) => ({ x: i, y: f }));
                    etiquetaNombre = `Pre-visualización Micción ${idEntero}`;
                }
            }
        } else {
            if (tipo === 'MADRE') {
                const dataCachéDil = UroMxApp.state.cachedAverages?.porDilatacion?.[idEntero.toString()];
                if (dataCachéDil && dataCachéDil.curva) {
                    puntosEspejo = dataCachéDil.curva.map((f, i) => ({ x: i, y: f }));
                    etiquetaNombre = `Pre-visualización Promedio Dilatación ${idEntero}`;
                }
            } else {
                const dataCachéDiaHermano = UroMxApp.state.cachedAverages?.porDia?.[idEntero.toString()];
                if (dataCachéDiaHermano && dataCachéDiaHermano.curva) {
                    puntosEspejo = dataCachéDiaHermano.curva.map((f, i) => ({ x: i, y: f }));
                    etiquetaNombre = `Pre-visualización Día Hermano ${idEntero}`;
                }
            }
        }

        // 2. CANDADO DE ESCALAS CONGELADAS VISUALES (COMO LA PUNTITA: SIN MOVER LA REJILLA) [STEM]
        const limiteXMinActual = GraficoDiagnostico.scales.x.min;
        const limiteXMaxActual = GraficoDiagnostico.scales.x.max;
        const limiteYMinActual = GraficoDiagnostico.scales.y.min;
        const limiteYMaxActual = GraficoDiagnostico.scales.y.max;

        GraficoDiagnostico.options.scales.x.min = limiteXMinActual;
        GraficoDiagnostico.options.scales.x.max = limiteXMaxActual;
        GraficoDiagnostico.options.scales.y.min = limiteYMinActual;
        GraficoDiagnostico.options.scales.y.max = limiteYMaxActual;
		   

        // 3. INYECCIÓN DIRECTA: Insertamos la curva invitada con tu constante de grosor fantasma
        if (puntosEspejo.length > 0) {
            GraficoDiagnostico.data.datasets.push({
                label: etiquetaNombre,
                data: puntosEspejo,
                borderColor: colorLinea,
                // Implementación estricta de tu constante de control
                borderWidth: UroMxApp.constants.CurvaFantasma || 2.0, 
                showLine: true, 
                tension: 0.4, 
                pointRadius: 0,
            });
        }
        
        GraficoDiagnostico.update('none'); // Refresco instantáneo a nivel de píxel
    },

    // =========================================================================
    // --- LIMPIADOR ULTRA LIMPIO POR TEXTO DE ETIQUETA INDESTRUCTIBLE ---
    // =========================================================================
    removeTemporaryHoverCurve: function() {
        const GraficoDiagnostico = this.chartFlujo;
        if (!GraficoDiagnostico) return;

        // FUMIGACIÓN ABSOLUTA: Filtra y evapora únicamente las series que inicien con "Pre-visualización"
        // Las curvas reales de abajo (ON/OFF) jamás se tocan ni pierden sus constantes nativas [STEM]
            GraficoDiagnostico.data.datasets = GraficoDiagnostico.data.datasets.filter(d => {
            return d.label && !d.label.startsWith('Pre-visualización');
        });

        // LIBERACIÓN DE ESCALAS TRAS LA SALIDA DEL PUNTERO
        if (GraficoDiagnostico.options.scales && GraficoDiagnostico.options.scales.x) {
            GraficoDiagnostico.options.scales.x.min = UroMxApp.state.mode === 'MX' ? 0 : -1;
            delete GraficoDiagnostico.options.scales.x.max;
            delete GraficoDiagnostico.options.scales.y.min;
            delete GraficoDiagnostico.options.scales.y.max;
        }

        GraficoDiagnostico.update('none'); // Todo regresa a la normalidad en un milisegundo
    },


    // =========================================================================
    // --- LIMPIADOR HERMÉTICO POR FILTRO DE TEXTO DE ETIQUETA (MÓDULO 5) [STEM] ---
    // =========================================================================
    removeTemporaryHoverCurve: function() {
        const GraficoDiagnostico = this.chartFlujo;
        if (!GraficoDiagnostico) return;

        // FUMIGACIÓN ABSOLUTA: Filtramos y eliminamos strictly las curvas cuyo label empiece con "Pre-visualización"
        // Al basarnos en el texto del label, el borrado es indestructible en la memoria de Chart.js [STEM]
            GraficoDiagnostico.data.datasets = GraficoDiagnostico.data.datasets.filter(d => {
            return d.label && !d.label.startsWith('Pre-visualización');
        });

        // Restauramos los grosores originales de tus naipes estables de nacimiento
        const botonClinicoActivo = UroMxApp.state.botonClinicoActivo;
        GraficoDiagnostico.data.datasets.forEach(dataset => {
            if (dataset.borderWidthOriginalBackup) {
                if (botonClinicoActivo) {
                    dataset.borderWidth = 1.210; // Mantiene intacta la línea del tiempo continua
                } else {
                    dataset.borderWidth = dataset.borderWidthOriginalBackup;
                }
                delete dataset.borderWidthOriginalBackup;
            }
        });
        
        GraficoDiagnostico.update('none'); // Todo regresa al origen exacto en un pestañeo
    },

//INICIO CAMBIO #8
    // =========================================================================
    // --- 📍 ANATOMÍA VISUAL: INYECTOR DE ANOTACIONES AL ROZAR TARJETAS [STEM] ---
    // =========================================================================
//INICIO CAMBIO #8 RECTIFICADO
    // =========================================================================
    // --- 📍 ANATOMÍA VISUAL: MOTOR DE ANOTACIONES CORREGIDO CON ÍNDICES [STEM] ---
    // =========================================================================
/*    injectAnatomicalMetricAnnotation: function(idMetricaLimpia) {
        const GraficoDiagnostico = this.chartFlujo;
        if (!GraficoDiagnostico || !GraficoDiagnostico.data.datasets || GraficoDiagnostico.data.datasets.length === 0) return;

        // CORREGIDO: Apuntamos strictly al elemento cero [0] del arreglo para leer los datos reales de las curvas
        const seriePrincipal = GraficoDiagnostico.data.datasets[0];
        const puntos = seriePrincipal ? (seriePrincipal.data || []) : [];
        if (puntos.length === 0) return;

        // Estructuramos un contenedor limpio para las marcas geométricas efímeras
        GraficoDiagnostico.options.plugins.annotation = { annotations: {} };
        const mapaAnotaciones = GraficoDiagnostico.options.plugins.annotation.annotations;

        // Jalamos el valor numérico consolidado desde tu estado o los registros del DOM
        const primerRegistro = UroMxApp.state.domFiltrado[0]; // Corregido con tu índice cero ganador de la consola
        if (!primerRegistro || !primerRegistro.calculos || !primerRegistro.calculos[idMetricaLimpia]) return;
        
        const valorNumericoMétrica = Number(primerRegistro.calculos[idMetricaLimpia].valor.toString().replace(/,/g, '') || 0);

        // --- 📐 DICCIONARIO DE GEOMETRÍA URODINÁMICA LÁSER ---
        switch (idMetricaLimpia) {
            
            case 'Vvoid':
                mapaAnotaciones.areaVolumenTotalSombreado = {
                    type: 'box',
                    xMin: puntos[0].x ?? 0,
                    xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1) * 10,
                    yMin: 0, yMax: GraficoDiagnostico.scales.y.max,
                    backgroundColor: 'rgba(46, 204, 113, 0.12)', // Verde pastel traslúcido
                    borderColor: 'transparent', clip: true
                };
                break;
        
            case 'Vflow':
                // Rellenamos el espacio interno de la silueta con un sombreado traslúcido pastel elegante
                mapaAnotaciones.areaVolumenSombreado = {
                    type: 'box',
                    xMin: puntos[0].x ?? 0,
                    xMax: primerRegistro.calculos.tflow.valor * 10,
                    yMin: 0,
                    yMax: GraficoDiagnostico.scales.y.max, 
                    backgroundColor: idMetricaLimpia === 'Vvoid' ? 'rgba(46, 204, 113, 0.12)' : 'rgba(52, 152, 219, 0.12)',
                    borderColor: 'transparent',
                    clip: true
                };
                break;

            case 'Vdrop':
                const tercioFinalIndex = Math.floor(puntos.length * 0.75);
                mapaAnotaciones.areaGoteoSombreado = {
                    type: 'box',
                    xMin: primerRegistro.calculos.tflow.valor * 10,
                    xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1),
                    yMin: 0,
                    yMax: GraficoDiagnostico.scales.y.max,
                    backgroundColor: 'rgba(241, 196, 15, 0.15)',
                    borderColor: 'transparent',
                    clip: true
                };
                break;

            case 'AcelApertura':
                let qMaxAp = 0; let xMaxAp = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > qMaxAp) { qMaxAp = py; xMaxAp = px; }
                });
                
                // Trazamos la diagonal desde el origen (0,0) hasta el vértice del Qmax real
                mapaAnotaciones.lineaDiagonalApertura = {
                    type: 'line',
                    xMin: 0,
                    xMax: xMaxAp,
                    yMin: 0,
                    yMax: qMaxAp,
                    borderColor: '#2ecc71', // Verde enérgico de apertura sana
                    borderWidth: 2.000,
                    clip: true,
                    label: { display: false }
                };
                break;

            // =========================================================================
            // CASE: TASA DE DESACELERACIÓN (DIAGONAL DE CAÍDA AL SUELO) [STEM]
            // =========================================================================
            case 'Decel':
                let qMaxDec = 0; let xMaxDec = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > qMaxDec) { qMaxDec = py; xMaxDec = px; }
                });
                // Buscamos el punto final donde el chorro firme toca el suelo
                let xFinalChorro = puntos[puntos.length - 1].x ?? (puntos.length - 1);
                let indiceCierre = puntos.findIndex((p, idx) => idx > xMaxDec && (typeof p === 'object' ? p.y : p) < 2.0);
                if (indiceCierre !== -1) xFinalChorro = puntos[indiceCierre].x ?? indiceCierre;

                // Trazamos la diagonal de caída desde el pico más alto hasta el suelo
                mapaAnotaciones.lineaDiagonalDesaceleracion = {
                    type: 'line',
                    xMin: xMaxDec,
                    xMax: xFinalChorro,
                    yMin: qMaxDec,
                    yMax: 0,
                    borderColor: '#e67e22', // Naranja elástico de vaciado terminal
                    borderWidth: 2.000,
                    clip: true,
                    label: { display: false }
                };
                break;

            // =========================================================================
            // CASE: SLEW RATE MÁXIMO (MICRO-TESTIGO VERTICAL EN LA SUBIDA RÁPIDA) [STEM]
            // =========================================================================
            case 'SlewRate':
                let qMaxSR = 0; let xMaxSR = 0; let idxPico = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > qMaxSR) { qMaxSR = py; xMaxSR = px; idxPico = idx; }
                });
                
                // Posicionamos el testigo justo a la mitad de la rampa de aceleración inicial [STEM]
                const idxMitadSubida = Math.floor(idxPico / 2);
                const xMitadSubida = puntos[idxMitadSubida]?.x || idxMitadSubida;
                const yMitadSubida = puntos[idxMitadSubida]?.y || (Number(puntos[idxMitadSubida]) || 0);

                // Dibujamos un micro-segmento inclinado acotado a la zona de máximo impulso
                mapaAnotaciones.segmentoSlewRateMax = {
                    type: 'line',
                    xMin: Math.max(0, xMitadSubida - 3),
                    xMax: Math.min(xMaxSR, xMitadSubida + 3),
                    yMin: Math.max(0, yMitadSubida - (valorNumericoMétrica * 0.3)),
                    yMax: Math.min(qMaxSR, yMitadSubida + (valorNumericoMétrica * 0.3)),
                    borderColor: '#95a5a6', // Gris plomo inercial
                    borderWidth: 2.500,
                    clip: true,
                    label: { display: false }
                };
                break;
        
        	case 'Qdrop':
                mapaAnotaciones.lineaFlujoPromedioHorizontal = {
                    type: 'line',
                    yMin: valorNumericoMétrica,
                    yMax: valorNumericoMétrica,
                    borderColor: '#2980b9',
                    borderWidth: 1.5,
                    borderDash: [5,5], // CORREGIDO CONTRA EL BUG
                    clip: true,
                    label: { display: false }
                };
                break;

        	case 'Q2':
        	case 'Qave':
                mapaAnotaciones.lineaFlujoPromedioHorizontal = {
                    type: 'line',
                    yMin: valorNumericoMétrica,
                    yMax: valorNumericoMétrica,
                    borderColor: '#2980b9',
                    borderWidth: 1.5,
                    borderDash: [5,5], // CORREGIDO CONTRA EL BUG
                    clip: true,
                    label: { display: false }
                };
                break;

            case 'LinPURR':
                const alturaMaxY = GraficoDiagnostico.scales.y.max || 20;
                const tamañoEscalon = alturaMaxY / 6;

                for (let grado = 0; grado <= 6; grado++) {
                    let r = 46, g = 204, b = 113, opacidad = 0.16;

                    if (grado === 2) {
                        r = 241; g = 196; b = 15; opacidad = 0.20;
                    } else if (grado >= 3) {
                        r = 231; g = 76; b = 60; opacidad = 0.06 * (grado - 1);
                    }

                    mapaAnotaciones[`escalonSchäfer_${grado}`] = {
                        type: 'box',
                        xMin: puntos.x ?? 0,
                        xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1),
                        yMin: grado * tamañoEscalon,
                        yMax: (grado + 1) * tamañoEscalon,
                        backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacidad})`,
                        borderColor: `rgba(${r}, ${g}, ${b}, 0.75)`,
                        borderWidth: 0.5,
                        clip: true
                    };
                }
                break;

            // =========================================================================
            // CASE: EL PASILLO DE CONTROL DE LA INTERMITENCIA URINARIA (CIV) [STEM]
            // =========================================================================
            case 'CIV':
                // Extraemos el flujo promedio de tu PHP para usarlo como el centro del pasillo
                const qAveCentro = Number(primerRegistro.calculos?.Qave?.valor || 10);
                // El porcentaje de variabilidad (CIV) abre el pasillo de tolerancia hacia arriba y abajo
                const porcentajeVariabilidad = valorNumericoMétrica / 100;
                const deltaPasillo = qAveCentro * porcentajeVariabilidad;

                mapaAnotaciones.pasilloVariabilidadIntermitencia = {
                    type: 'box',
                    xMin: puntos[0].x ?? 0,
                    xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1),
                    yMin: Math.max(0, qAveCentro - deltaPasillo),
                    yMax: Math.min(GraficoDiagnostico.scales.y.max, qAveCentro + deltaPasillo),
                    backgroundColor: 'rgba(155, 89, 182, 0.12)', // Pasillo morado suave de estabilidad
                    borderColor: 'transparent',
                    clip: true
                };
                
                // Inyectamos de fondo la línea central del promedio para que sirva de guía visual al pasillo
                mapaAnotaciones.ejeCentralPasilloQave = {
                    type: 'line',
                    yMin: qAveCentro, yMax: qAveCentro,
                    borderColor: 'rgba(155, 89, 182, 0.4)', borderWidth: 1, borderDash: [3,2],
                    clip: true
                };
                break;

        	case 'Qmax':
                let yMaxValor = 0; let xMaxValor = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > yMaxValor) { yMaxValor = py; xMaxValor = px; }
                });
                mapaAnotaciones.puntoPicoQmax = {
                    type: 'point',
                    xValue: xMaxValor,
                    yValue: yMaxValor,
                    backgroundColor: '#e74c3c',
                    radius: 6,
                    borderColor: '#ffffff',
                    borderWidth: 2
                };
                break;

            case 'tvoid':
            case 'tflow':
            case 'tQMax':
                // Cancelamos cualquier animación vieja que ande flotando en el buffer
                if (UroMxApp.state.idIntervaloFlechaAnimada) {
                    clearInterval(UroMxApp.state.idIntervaloFlechaAnimada);
                }

                let pasoEjeXVirtual = 0;
                const valorDestinoFinalX = valorNumericoMétrica;
                
                // REGLA SOLICITADA: Para que tarde exactamente 1/10 del valor en segundos,
                // calculamos incrementos fijos cada 30 milisegundos para una cinemática tersa [STEM]
                const totalPasosAritmeticos = 33; // Factor de cuadros por segundo de animación (FPS)
                const tasaIncrementoX = valorDestinoFinalX / totalPasosAritmeticos;

                // Definimos la configuración estética de tu flecha de tiempo horizontal
                let colorFlechaEstetico = '#7f8c8d'; // Gris por defecto
                if (idMetricaLimpia === 'tQMax') colorFlechaEstetico = '#e74c3c'; // Rojo contractilidad
                if (idMetricaLimpia === 't95') colorFlechaEstetico = '#9b59b6';   // Morado cierre

                UroMxApp.state.idIntervaloFlechaAnimada = setInterval(() => {
                    pasoEjeXVirtual += tasaIncrementoX;

                    // Cuando la punta de la flecha llega a la frontera médica, congela el cronómetro
                    if (pasoEjeXVirtual >= valorDestinoFinalX) {
                        pasoEjeXVirtual = valorDestinoFinalX;
                        clearInterval(UroMxApp.state.idIntervaloFlechaAnimada);
                    }

                    // Inyectamos la flecha horizontal sobre la base del gráfico (yMin/Max en cero)
                    mapaAnotaciones.flechaCinematicaTiempoHorizontal = {
                        type: 'line',
                        xMin: 0,
                        xMax: pasoEjeXVirtual * 10,
                        yMin: 0,
                        yMax: 0,
                        borderColor: colorFlechaEstetico,
                        borderWidth: 4.000, // Flecha gruesa nítida de control
                        arrowHeads: { end: { display: true, fill: true, length: 7, width: 7 } }, // Punta de flecha terminal
                        clip: true
                    };
                    
                    GraficoDiagnostico.update('none'); // Renderizado instantáneo por cuadro sin parpadeos
                }, 30); // Tasa de refresco de 30ms para emular seda móvil
                break;

            case 't10':
                mapaAnotaciones.arpónT10Vertical = {
                    type: 'line', mode: 'vertical', scaleID: 'x',
                    value: valorNumericoMétrica * 10,
                    borderColor: '#7f8c8d', borderWidth: 1.5, borderDash: [3,3], // CORREGIDO CONTRA EL BUG
                    clip: true, label: { display: false }
                };
                break;

        	case 't95':
                mapaAnotaciones.arpónT95Vertical = {
                    type: 'line', mode: 'vertical', scaleID: 'x',
                    value: valorNumericoMétrica * 10,
                    borderColor: '#9b59b6', borderWidth: 1.5, borderDash: [3,3],
                    clip: true, label: { display: false }
                };
                break;
        }

        GraficoDiagnostico.update('none'); 
    },
*//*
//INICIO CAMBIO #5658
    injectAnatomicalMetricAnnotation: function(idMetricaLimpia) {
        // --- 📍 LÍNEA DE ACUPUNTURA MODAL: REDIRIGIMOS EL TIMÓN HACIA EL ESPEJO ---
        // Si la ventana de diagnóstico está abierta, el switch trabajará strictly sobre ella [STEM]
        const GraficoDiagnostico = this.chartDiagnosticoLimpio;
        if (!GraficoDiagnostico || !GraficoDiagnostico.data.datasets || GraficoDiagnostico.data.datasets.length === 0) return;

       const seriePrincipal = GraficoDiagnostico.data.datasets[0];
        const puntos = seriePrincipal ? (seriePrincipal.data || []) : [];
        if (puntos.length === 0) return;

        // Estructuramos un contenedor limpio para las marcas geométricas efímeras
        GraficoDiagnostico.options.plugins.annotation = { annotations: {} };
        const mapaAnotaciones = GraficoDiagnostico.options.plugins.annotation.annotations;

        // Jalamos el valor numérico consolidado desde tu estado o los registros del DOM
        let primerRegistro = UroMxApp.state.domFiltrado[8]; // Corregido con tu índice cero ganador de la consola
        if (!primerRegistro || !primerRegistro.calculos || !primerRegistro.calculos[idMetricaLimpia]) return;
        
        const valorNumericoMétrica = Number(primerRegistro.calculos[idMetricaLimpia].valor.toString().replace(/,/g, '') || 0);

        // --- 📐 DICCIONARIO DE GEOMETRÍA URODINÁMICA LÁSER ---
        switch (idMetricaLimpia) {
            
            case 'Vvoid':
                // Prueba estática para Vvoid: forzar un color azul plano completo
                GraficoDiagnostico.data.datasets[8].fill = 'origin';
                GraficoDiagnostico.data.datasets[8].backgroundColor = 'rgba(0, 0, 255, 0.3)';
                break;
              
        
            case 'Vflow':
                const regVflow = UroMxApp.state.domFiltrado;
                if (regVflow && regVflow.calculos?.tflow && regVflow.flujo_mls) {
                    let color = regVflow.calculos.Vflow?.semaforo === 'ambar' ? '#f1c40f' : (regVflow.calculos.Vflow?.semaforo === 'rojo' ? '#e74c3c' : '#2ecc71');
                    // El corte ocurre exactamente en el índice de tus 100ms reales de PHP [1.3]
                    const limiteIndiceVflow = Math.floor(Number(regVflow.calculos.tflow.valor) * 10);
                    let puntosVflow = [];

                    regVflow.flujo_mls.forEach((f, i) => {
                        if (i <= limiteIndiceVflow) puntosVflow.push({ x: i, y: Number(f) });
                    });
                    
                    if (puntosVflow.length > 0) {
                        puntosVflow.push({ x: puntosVflow[puntosVflow.length - 1].x, y: 0 });
                    }

                    this.chartFlujo.data.datasets.push({
                        label: 'Pre-visualización Vflow', data: puntosVflow,
                        borderColor: 'transparent', borderWidth: 0, fill: 'origin',
                        backgroundColor: hexToRgbaAlpha(color, 0.18), pointRadius: 0, tension: 0.4,
                        esCurvaEfímeraVolumen: true
                    });
                }
                break;

            case 'Vdrop':
                const regVdrop = UroMxApp.state.domFiltrado;
                if (regVdrop && regVdrop.calculos?.tflow && regVdrop.flujo_mls) {
                    let color = regVdrop.calculos.Vdrop?.semaforo === 'verde' ? '#2ecc71' : (regVdrop.calculos.Vdrop?.semaforo === 'rojo' ? '#e74c3c' : '#f1c40f');
                    const limiteIndiceVdrop = Math.floor(Number(regVdrop.calculos.tflow.valor) * 10);
                    let puntosVdrop = [];

                    puntosVdrop.push({ x: limiteIndiceVdrop, y: 0 });
                    regVdrop.flujo_mls.forEach((f, i) => {
                        if (i >= limiteIndiceVdrop) puntosVdrop.push({ x: i, y: Number(f) });
                    });

                    this.chartFlujo.data.datasets.push({
                        label: 'Pre-visualización Vdrop', data: puntosVdrop,
                        borderColor: 'transparent', borderWidth: 0, fill: 'origin',
                        backgroundColor: hexToRgbaAlpha(color, 0.20), pointRadius: 0, tension: 0.4,
                        esCurvaEfímeraVolumen: true
                    });
                }
                break;

            case 'Qmax':
                let yMaxValor = 0; let xMaxValor = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > yMaxValor) { yMaxValor = py; xMaxValor = px; }
                });
                mapaAnotaciones.puntoPicoQmax = {
                    type: 'point', xValue: xMaxValor, yValue: yMaxValor,
                    backgroundColor: '#e74c3c', radius: 6, borderColor: '#ffffff', borderWidth: 2
                };
                break;

            case 'AcelApertura':
                let qMaxAp = 0; let xMaxAp = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > qMaxAp) { qMaxAp = py; xMaxAp = px; }
                });
                mapaAnotaciones.lineaDiagonalApertura = {
                    type: 'line', xMin: 0, xMax: xMaxAp, yMin: 0, yMax: qMaxAp,
                    borderColor: '#2ecc71', borderWidth: 2.000, clip: true
                };
                break;

            case 'Decel':
                let qMaxDec = 0; let xMaxDec = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > qMaxDec) { qMaxDec = py; xMaxDec = px; }
                });
                const valorTflowReal = Number(primerRegistro.calculos?.tflow?.valor || (puntos.length - 1));
                mapaAnotaciones.lineaDiagonalDesaceleracion = {
                    type: 'line', xMin: xMaxDec, xMax: valorTflowReal * 10, yMin: qMaxDec, yMax: 0,
                    borderColor: '#e67e22', borderWidth: 2.000, clip: true
                };
                break;

            case 'SlewRate':
                let qMaxSR = 0; let idxPico = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    if (py > qMaxSR) { qMaxSR = py; idxPico = idx; }
                });
                const idxMitadSubida = Math.floor(idxPico / 2);
                const xMitadSubida = puntos[idxMitadSubida]?.x || idxMitadSubida;
                const yMitadSubida = puntos[idxMitadSubida]?.y || 0;

                mapaAnotaciones.segmentoSlewRateMax = {
                    type: 'line',
                    xMin: Math.max(0, xMitadSubida - 20), xMax: Math.min(xMaxSR, xMitadSubida + 20),
                    yMin: Math.max(0, yMitadSubida - (valorNumericoMétrica * 0.2)), yMax: Math.min(qMaxSR, yMitadSubida + (valorNumericoMétrica * 0.2)),
                    borderColor: '#95a5a6', borderWidth: 2.500, clip: true
                };
                break;

            // =========================================================================
            // EL MAPA DE CALOR CLÍNICO DE LOS 6 ESCALONES DE SCHÄFER (REEMPLAZO) [STEM]
            // =========================================================================
            case 'LinPURR':
                const alturaMaxY = GraficoDiagnostico.scales.y.max || 20;
                const tamañoEscalon = alturaMaxY / 6;

                for (let grado = 0; grado <= 6; grado++) {
                    let r = 46, g = 204, b = 113, opacidad = 0.08;
                    if (grado === 2) { r = 241; g = 196; b = 15; opacidad = 0.10; } 
                    else if (grado >= 3) { r = 231; g = 76; b = 60; opacidad = 0.03 * (grado - 1); }

                    mapaAnotaciones[`escalonSchäfer_${grado}`] = {
                        type: 'box',
                        xMin: puntos[0].x ?? 0, xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1),
                        yMin: grado * tamañoEscalon, yMax: (grado + 1) * tamañoEscalon,
                        backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacidad})`,
                        borderColor: `rgba(${r}, ${g}, ${b}, 0.05)`, borderWidth: 0.5, clip: true
                    };
                }
                break;

            case 'CIV':
                const qAveCentro = Number(primerRegistro.calculos?.Qave?.valor || 10);
                const deltaPasillo = qAveCentro * (valorNumericoMétrica / 100);

                mapaAnotaciones.pasilloVariabilidadIntermitencia = {
                    type: 'box',
                    xMin: puntos[0].x ?? 0, xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1),
                    yMin: Math.max(0, qAveCentro - deltaPasillo), yMax: Math.min(GraficoDiagnostico.scales.y.max, qAveCentro + deltaPasillo),
                    backgroundColor: 'rgba(155, 89, 182, 0.12)', clip: true
                };
                mapaAnotaciones.ejeCentralPasilloQave = {
                    type: 'line', yMin: qAveCentro, yMax: qAveCentro,
                    borderColor: 'rgba(155, 89, 182, 0.4)', borderWidth: 1, borderDash: [5,5], clip: true
                };
                break;

            // =========================================================================
            // EL GRUPO DE TIEMPOS ORDINARIOS (FLECHAS HORIZONTALES CINEMÁTICAS)
            // =========================================================================
            case 'tvoid':
            case 'tflow':
            case 'tQMax':
            case 't10':
            case 't95':
                if (UroMxApp.state.idIntervaloFlechaAnimada) clearInterval(UroMxApp.state.idIntervaloFlechaAnimada);

                let pasoEjeXVirtual = 0;
                const valorDestinoFinalX = valorNumericoMétrica * 10; // Multiplicamos por 10 por tu factor
                const totalPasosAritmeticos = 33; 
                const tasaIncrementoX = valorDestinoFinalX / totalPasosAritmeticos;

                let colorFlechaEstetico = '#7f8c8d';
                if (idMetricaLimpia === 'tQMax') colorFlechaEstetico = '#e74c3c';
                if (idMetricaLimpia === 't95') colorFlechaEstetico = '#9b59b6';

                UroMxApp.state.idIntervaloFlechaAnimada = setInterval(() => {
                    pasoEjeXVirtual += tasaIncrementoX;
                    if (pasoEjeXVirtual >= valorDestinoFinalX) {
                        pasoEjeXVirtual = valorDestinoFinalX;
                        clearInterval(UroMxApp.state.idIntervaloFlechaAnimada);
                    }
                    mapaAnotaciones.flechaCinematicaTiempoHorizontal = {
                        type: 'line', xMin: 0, xMax: pasoEjeXVirtual, yMin: 0, yMax: 0,
                        borderColor: colorFlechaEstetico, borderWidth: 4.000,
                        arrowHeads: { end: { display: true, fill: true, length: 7, width: 7 } }, clip: true
                    };
                    GraficoDiagnostico.update('none');
                }, 30);
                break;
        }
        GraficoDiagnostico.update('none');
    },
//FIN CAMBIO #23
*/
    injectAnatomicalMetricAnnotation: function(idMetricaLimpia) {
        // CORREGIDO CON MIRA LÁSER: Apuntamos al nombre unificado real de tu nuevo control hijo [STEM]
        const graficoActivo = this.GraficoDiagnostico;
        if (!graficoActivo || !graficoActivo.data.datasets || graficoActivo.data.datasets.length === 0) return;

        const seriePrincipal = graficoActivo.data.datasets[0];
        const puntos = seriePrincipal ? (seriePrincipal.data || []) : [];
        if (puntos.length === 0) return;

        graficoActivo.options.plugins.annotation = { annotations: {} };
        const mapaAnotaciones = graficoActivo.options.plugins.annotation.annotations;

        const focus = UroMxApp.state.lastContext;
        if (!focus) return;
        const idFocus = Math.floor(Number(focus.id));
        const tipoFocus = focus.contexto;
        const modoActivo = UroMxApp.state.mode;

        let registroClinicoReal = null;
        if (modoActivo === 'MX') {
            registroClinicoReal = UroMxApp.state.domFiltrado.find(item => tipoFocus === 'MADRE' ? Math.floor(Number(item.idDia)) === idFocus : Number(item.idMix) === idFocus);
        } else {
            registroClinicoReal = UroMxApp.state.domFiltrado.find(item => tipoFocus === 'MADRE' ? Math.floor(Number(item.idDilatacion)) === idFocus : Math.floor(Number(item.idDia)) === idFocus);
        }
        if (!registroClinicoReal || !registroClinicoReal.calculos || !registroClinicoReal.calculos[idMetricaLimpia]) return;

        const datosMetricaDOM = registroClinicoReal.calculos[idMetricaLimpia];
        const valorNumericoMétrica = Number(datosMetricaDOM.valor.toString().replace(/,/g, '') || 0);
        if (Number(datosMetricaDOM.orden ?? -1) === -1) {
            // Si el orden del servidor es -1, abortamos el renderizado y apagamos el parpadeo de ráfaga
            graficoActivo.options.plugins.title = { display: true, text: (datosMetricaDOM.nombre || idMetricaLimpia).toUpperCase(), color: '#7f8c8d' };
            graficoActivo.update('none');
            return; 
        }    

        // FORMULA UNIFICADA AUTOMATIZADA: Muestra estrictamente el nombre real de tu DOM relacional
        const textoTitulo = `${datosMetricaDOM.nombre || idMetricaLimpia}`;
        graficoActivo.options.plugins.title = {
            display: true,
            text: textoTitulo.toUpperCase(),
            color: '#2c3e50',
            font: { size: 13, weight: 'bold' }
        };

        const hexToRgbaAlpha = (hex, a) => {
            const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
            return "rgba(" + r + "," + g + "," + b + "," + a + ")";
        };

        switch (idMetricaLimpia) {
            case 'Vvoid':
                let colorVvoid = registroClinicoReal.calculos.Vvoid.semaforo === 'ambar' ? '#f1c40f' : (registroClinicoReal.calculos.Vvoid.semaforo === 'rojo' ? '#e74c3c' : '#2ecc71');
                mapaAnotaciones.areaVolumenTotalSombreado = {
                    type: 'box', xMin: puntos[0].x ?? 0, xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1) * 10,
                    yMin: 0, yMax: graficoActivo.scales.y.max, backgroundColor: hexToRgbaAlpha(colorVvoid, 0.12), borderColor: 'transparent', clip: true
                };
                break;
        
            case 'Vflow':
                let colorVflow = registroClinicoReal.calculos.Vflow?.semaforo === 'ambar' ? '#f1c40f' : (registroClinicoReal.calculos.Vflow?.semaforo === 'rojo' ? '#e74c3c' : '#2ecc71');
                const tflowValor = Number(registroClinicoReal.calculos.tflow?.valor || 0);
                mapaAnotaciones.areaVolumenSombreado = {
                    type: 'box', xMin: puntos[0].x ?? 0, xMax: tflowValor * 10,
                    yMin: 0, yMax: graficoActivo.scales.y.max, backgroundColor: hexToRgbaAlpha(colorVflow, 0.12), borderColor: 'transparent', clip: true
                };
                break;

            case 'Vdrop':
                let colorVdrop = registroClinicoReal.calculos.Vdrop?.semaforo === 'verde' ? '#2ecc71' : (registroClinicoReal.calculos.Vdrop?.semaforo === 'rojo' ? '#e74c3c' : '#f1c40f');
                const tflowDrop = Number(registroClinicoReal.calculos.tflow?.valor || 0);
                mapaAnotaciones.areaGoteoSombreado = {
                    type: 'box', xMin: tflowDrop * 10, xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1) * 10,
                    yMin: 0, yMax: graficoActivo.scales.y.max, backgroundColor: hexToRgbaAlpha(colorVdrop, 0.15), borderColor: 'transparent', clip: true
                };
                break;
            case 'Qave':
                mapaAnotaciones.lineaFlujoPromedioHorizontal = {
                    type: 'line', yMin: valorNumericoMétrica, yMax: valorNumericoMétrica,
                    borderColor: '#2980b9', borderWidth: 1.5, borderDash: [5,5], clip: true
                };
                break;

            case 'Qmax':
                let yMaxValor = 0; let xMaxValor = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > yMaxValor) { yMaxValor = py; xMaxValor = px; }
                });
                mapaAnotaciones.puntoPicoQmax = {
                    type: 'point', xValue: xMaxValor, yValue: yMaxValor,
                    backgroundColor: '#e74c3c', radius: 6, borderColor: '#ffffff', borderWidth: 2
                };
                break;

            case 'AcelApertura':
                let qMaxAp = 0; let xMaxAp = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > qMaxAp) { qMaxAp = py; xMaxAp = px; }
                });
                mapaAnotaciones.lineaDiagonalApertura = {
                    type: 'line', xMin: 0, xMax: xMaxAp, yMin: 0, yMax: qMaxAp, borderColor: '#2ecc71', borderWidth: 2, clip: true
                };
                break;

            case 'Decel':
                let qMaxDec = 0; let xMaxDec = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    let px = typeof p === 'object' ? p.x : idx;
                    if (py > qMaxDec) { qMaxDec = py; xMaxDec = px; }
                });
                const tflowDecel = Number(registroClinicoReal.calculos.tflow?.valor || 0);
                mapaAnotaciones.lineaDiagonalDesaceleracion = {
                    type: 'line', xMin: xMaxDec, xMax: tflowDecel * 10, yMin: qMaxDec, yMax: 0, borderColor: '#e67e22', borderWidth: 2, clip: true
                };
                break;

            case 'SlewRate':
                let qMaxSR = 0; let idxPico = 0;
                puntos.forEach((p, idx) => {
                    let py = typeof p === 'object' ? p.y : p;
                    if (py > qMaxSR) { qMaxSR = py; idxPico = idx; }
                });
                const idxMitadSubida = Math.floor(idxPico / 2);
                const xMitadSubida = puntos[idxMitadSubida]?.x || idxMitadSubida;
                const yMitadSubida = puntos[idxMitadSubida]?.y || 0;
                mapaAnotaciones.segmentoSlewRateMax = {
                    type: 'line', xMin: Math.max(0, xMitadSubida - 20), xMax: Math.min(puntos[puntos.length - 1].x, xMitadSubida + 20),
                    yMin: Math.max(0, yMitadSubida - (valorNumericoMétrica * 0.2)), yMax: Math.min(qMaxSR, yMitadSubida + (valorNumericoMétrica * 0.2)),
                    borderColor: '#95a5a6', borderWidth: 2.5, clip: true
                };
                break;

            case 'LinPURR':
                const alturaMaxY = graficoActivo.scales.y.max || 20;
                const tamañoEscalon = alturaMaxY / 6;
                for (let grado = 0; grado <= 6; grado++) {
                    let r = 46, g = 204, b = 113, opacidad = 0.08;
                    if (grado === 2) { r = 241; g = 196; b = 15; opacidad = 0.10; } 
                    else if (grado >= 3) { r = 231; g = 76; b = 60; opacidad = 0.03 * (grado - 1); }
                    mapaAnotaciones[`escalonSchäfer_${grado}`] = {
                        type: 'box', xMin: puntos[0].x ?? 0, xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1) * 10,
                        yMin: grado * tamañoEscalon, yMax: (grado + 1) * tamañoEscalon,
                        backgroundColor: "rgba(" + r + "," + g + "," + b + "," + opacidad + ")", borderColor: "rgba(" + r + "," + g + "," + b + ", 0.05)", borderWidth: 0.5, clip: true
                    };
                }
                break;

            case 'CIV':
                const qAveCentro = Number(registroClinicoReal.calculos.Qave?.valor || 10);
                const deltaPasillo = qAveCentro * (valorNumericoMétrica / 100);
                mapaAnotaciones.pasilloVariabilidadIntermitencia = {
                    type: 'box', xMin: puntos[0].x ?? 0, xMax: puntos[puntos.length - 1].x ?? (puntos.length - 1) * 10,
                    yMin: Math.max(0, qAveCentro - deltaPasillo), yMax: Math.min(graficoActivo.scales.y.max, qAveCentro + deltaPasillo),
                    backgroundColor: 'rgba(155, 89, 182, 0.12)', clip: true
                };
                mapaAnotaciones.ejeCentralPasilloQave = {
                    type: 'line', yMin: qAveCentro, yMax: qAveCentro, borderColor: 'rgba(155, 89, 182, 0.4)', borderWidth: 1, borderDash: [5,5], clip: true
                };
                break;

            case 'tvoid':
            case 'tflow':
            case 'tQMax':
            case 't10':
            case 't95':
                if (UroMxApp.state.idIntervaloFlechaAnimada) clearInterval(UroMxApp.state.idIntervaloFlechaAnimada);

                let pasoEjeXVirtual = 0;
                const valorDestinoFinalX = valorNumericoMétrica * 10;
                const totalPasosAritmeticos = 33; 
                const tasaIncrementoX = valorDestinoFinalX / totalPasosAritmeticos;

                let colorFlechaEstetico = '#7f8c8d';
                if (idMetricaLimpia === 'tQMax') colorFlechaEstetico = '#e74c3c';
                if (idMetricaLimpia === 't95') colorFlechaEstetico = '#9b59b6';

                mapaAnotaciones.arponVerticalHitoFijo = {
                    type: 'line', mode: 'vertical', scaleID: 'x', value: valorDestinoFinalX,
                    borderColor: colorFlechaEstetico, borderWidth: 1.5, borderDash: [5,5], clip: true
                };

                UroMxApp.state.idIntervaloFlechaAnimada = setInterval(() => {
                    pasoEjeXVirtual += tasaIncrementoX;
                    if (pasoEjeXVirtual >= valorDestinoFinalX) {
                        pasoEjeXVirtual = valorDestinoFinalX;
                        clearInterval(UroMxApp.state.idIntervaloFlechaAnimada);
                    }
                    mapaAnotaciones.flechaCinematicaTiempoHorizontal = {
                        type: 'line', xMin: 0, xMax: pasoEjeXVirtual, yMin: 0, yMax: 0,
                        borderColor: colorFlechaEstetico, borderWidth: 4,
                        arrowHeads: { end: { display: true, fill: true, length: 7, width: 7 } }, clip: true
                    };
                    graficoActivo.update('none');
                }, 30);
                break;
        }
        graficoActivo.update('none');
    },
// FIN DE LA FUNCIÓN COMPLETA INJECTANATOMICALMETRICANNOTATION

    ModoDiagnosticoEntrada: function() {
        if (UroMxApp.state.modoDiagnosticoActivo) return;
        console.log("UroMx Módulo 5: Iniciando Modo Diagnóstico Avanzado...");

        if (!UroMxApp.state.lastContext || UroMxApp.state.lastContext.id === null || UroMxApp.state.lastContext.id === undefined) {
            const madresSeleccionadas = Array.from(UroMxApp.state.selectedMothers || []);
            const hijosSeleccionados = Array.from(UroMxApp.state.selectedChildren || []);
            if (hijosSeleccionados.length > 0) {
                UroMxApp.state.lastContext = { contexto: 'HIJO', id: hijosSeleccionados[hijosSeleccionados.length - 1], origen: 'CLINICO' };
            } else if (madresSeleccionadas.length > 0) {
                UroMxApp.state.lastContext = { contexto: 'MADRE', id: madresSeleccionadas[madresSeleccionadas.length - 1], origen: 'CLINICO' };
            }
        }

        const focus = UroMxApp.state.lastContext;
        if (!focus || focus.id === null || focus.id === undefined) {
            alert("Por favor, seleccione primero una curva en el tablero para analizar.");
            return;
        }

        const idBuscado = Math.floor(Number(focus.id));
        const tipoBuscado = focus.contexto;
        const modoActivo = UroMxApp.state.mode;

        const panelKinderReal = document.getElementById('KinderContenedor') || document.querySelector('.KinderContenedor');
        if (panelKinderReal && panelKinderReal.style) {
            panelKinderReal.style.opacity = '0.01'; 
            panelKinderReal.style.pointerEvents = 'none'; 
        }
        
        const tooltipFijoReal = typeof tooltipFlotante !== 'undefined' ? tooltipFlotante : document.getElementById('uro-tooltip-fijo-analitico');
        if (tooltipFijoReal && tooltipFijoReal.style) {
            tooltipFijoReal.style.opacity = '0.01'; 
            tooltipFijoReal.style.pointerEvents = 'none';
        }

        // =========================================================================
        // --- CONGELAMIENTO AL RAS DEL ESS SIDEBAR Y EL ENGRANE RECTIFICADO ---
        // =========================================================================
        // Capturamos el contenedor maestro lateral completo de tu index.php
        const barraLateralDOM = document.querySelector('.sidebar');
        if (barraLateralDOM && barraLateralDOM.style) {
            barraLateralDOM.style.cursor = 'not-allowed';
            // Bloqueamos los clicks strictly en los BotonMadre y el div de acciones
            barraLateralDOM.querySelectorAll('.BotonMadre, .panel-acciones, button, aside').forEach(el => {
                el.style.pointerEvents = 'none';
                el.style.cursor = 'not-allowed';
            });
        }

        // Bloqueamos también la Cafeteria interna por resguardo perimetral
        const panelCafeteriaDOM = document.getElementById('Cafeteria') || document.querySelector('.Cafeteria');
        if (panelCafeteriaDOM && panelCafeteriaDOM.style) {
            panelCafeteriaDOM.style.cursor = 'not-allowed';
            panelCafeteriaDOM.querySelectorAll('.BotonMadre').forEach(b => {
                b.style.pointerEvents = 'none';
                b.style.cursor = 'not-allowed';
            });
        }

        // Bloqueamos la barra de filtros superior externa si existiera
        const barraFiltrosDOM = document.getElementById('contenedor-filtros') || document.querySelector('.seccion-filtros');
        if (barraFiltrosDOM && barraFiltrosDOM.style) {
            barraFiltrosDOM.style.cursor = 'not-allowed';
            barraFiltrosDOM.querySelectorAll('input, select, button').forEach(el => {
                el.style.pointerEvents = 'none';
                el.style.cursor = 'not-allowed';
            });
        }
        let puntosCurvaFinal = [];
        let etiquetaNombre = "";
        let colorLinea = UroMxApp.getColor(idBuscado, true);
        const registroClinicoReal = UroMxApp.state.domFiltrado.find(item => tipoBuscado === 'MADRE' ? Math.floor(Number(item.idDia)) === idBuscado : Number(item.idMix) === idBuscado);

        if (modoActivo === 'MX') {
            if (tipoBuscado === 'MADRE') {
                const dataCacheDia = UroMxApp.state.cachedAverages?.porDia?.[idBuscado.toString()];
                if (dataCacheDia && dataCacheDia.curva) puntosCurvaFinal = dataCacheDia.curva.map((f, i) => ({ x: i, y: Number(f) }));
                etiquetaNombre = `Promedio Día ${idBuscado}`;
            } else {
                if (registroClinicoReal && registroClinicoReal.flujo_mls) puntosCurvaFinal = registroClinicoReal.flujo_mls.map((f, i) => ({ x: i, y: Number(f) }));
                etiquetaNombre = `Micción ${idBuscado}`;
            }
        } else {
            if (tipoBuscado === 'MADRE') {
                const dataCacheDil = UroMxApp.state.cachedAverages?.porDilatacion?.[idBuscado.toString()];
                if (dataCacheDil && dataCacheDil.curva) puntosCurvaFinal = dataCacheDil.curva.map((f, i) => ({ x: i, y: Number(f) }));
                etiquetaNombre = `Promedio Dilatación ${idBuscado}`;
            } else {
                const dataCacheDiaHermano = UroMxApp.state.cachedAverages?.porDia?.[idBuscado.toString()];
                if (dataCacheDiaHermano && dataCacheDiaHermano.curva) puntosCurvaFinal = dataCacheDiaHermano.curva.map((f, i) => ({ x: i, y: Number(f) }));
                etiquetaNombre = `Día Hermano ${idBuscado}`;
            }
        }

        if (puntosCurvaFinal.length === 0) return;

        UroMxApp.state.datasetDiagnostico = {
            label: etiquetaNombre, data: puntosCurvaFinal, borderColor: colorLinea,
            borderWidth: 3.5, showLine: true, tension: 0.4, pointRadius: 0, fill: false
        };

        const lienzoOriginal = this.chartFlujo ? this.chartFlujo.canvas : document.getElementById('GraficoMiccionCanvas');
        if (!lienzoOriginal) return;
        const contenedorPadre = lienzoOriginal.parentElement;

        let GraficoDiagnosticoContenedor = document.getElementById('GraficoDiagnosticoContenedor');
        if (!GraficoDiagnosticoContenedor) {
            GraficoDiagnosticoContenedor = document.createElement('div');
            GraficoDiagnosticoContenedor.id = 'GraficoDiagnosticoContenedor';
            GraficoDiagnosticoContenedor.style.cssText = 'position:absolute; left:0; top:0; width:100%; height:100%; background:#ffffff; z-index:100; box-sizing:border-box; padding:5px; display:flex; flex-direction:column;';
            
            GraficoDiagnosticoContenedor.innerHTML = `
                <div style="display:flex; justify-content:flex-end; padding:2px 5px; background:#fafafa; border-bottom:1px solid #eee;">
                    <button id="uro-btn-salir-diagnostico-vb6" style="background:#e74c3c; border:none; color:#fff; font-size:10px; font-weight:bold; padding:3px 8px; border-radius:4px; cursor:pointer;">✕ SALIR DEL MODO DIAGNÓSTICO</button>
                </div>
                <div style="flex:1; width:100%; position:relative;">
                    <canvas id="GraficoDiagnosticoCanvas" style="width:100%; height:100%;"></canvas>
                </div>
            `;
            contenedorPadre.appendChild(GraficoDiagnosticoContenedor);

            GraficoDiagnosticoContenedor.querySelector('#uro-btn-salir-diagnostico-vb6').onclick = (e) => {
                e.preventDefault();
                if (typeof UroMxApp.ChartManager.ModoDiagnosticoSalida === 'function') {
                    UroMxApp.ChartManager.ModoDiagnosticoSalida();
                }
            };
        }
        if (this.GraficoDiagnostico) this.GraficoDiagnostico.destroy();

        this.GraficoDiagnostico = new Chart(document.getElementById('GraficoDiagnosticoCanvas'), {
            type: 'line', data: { datasets: [UroMxApp.state.datasetDiagnostico] },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                layout: { padding: { top: 10, left: 10, right: 15, bottom: 0 } },
                scales: { 
                    x: { type: 'linear', position: 'bottom', offset: false, grace: 0, ticks: { padding: 0, callback: function(v) { return v >= 0 ? (v / 10).toFixed(1) : ''; }, stepSize: 10 }, title: { display: true, text: 'Tiempo [s]', padding: 0 } }, 
                    y: { type: 'linear', offset: false, grace: 0, title: { display: true, text: 'Volumen [mL]' } } 
                },
                plugins: { 
                    legend: { display: false }, tooltip: { enabled: false }, annotation: { annotations: {} },
                    title: { display: true, text: 'PARÁMETROS CLÍNICOS', color: '#2c3e50', font: { size: 13, weight: 'bold' } }
                }
            }
        });

        UroMxApp.state.modoDiagnosticoActivo = true;

        const contenedorCalculos = document.getElementById('contenedor-calculos') || document.getElementById('tabla-calculos');
        const listadoBotonesDOM = contenedorCalculos ? Array.from(contenedorCalculos.querySelectorAll('.BotonClinico')) : [];
        const tarjetasTour = listadoBotonesDOM.map(btn => btn.dataset.idMetrica).filter(Boolean);
        
        let indiceTour = 0;
        if (UroMxApp.state.idIntervaloTourAutomatico) clearInterval(UroMxApp.state.idIntervaloTourAutomatico);

        UroMxApp.state.idIntervaloTourAutomatico = setInterval(() => {
            if (tarjetasTour.length === 0) return;

            let metricaActual = tarjetasTour[indiceTour];
            
            if (this.GraficoDiagnostico && this.GraficoDiagnostico.options.plugins?.annotation) {
                this.GraficoDiagnostico.options.plugins.annotation.annotations = {};
            }

            document.querySelectorAll('.BotonClinico').forEach(btn => {
                btn.style.animation = 'none'; btn.style.opacity = '1';
            });

            const botonActualDOM = document.querySelector(`.BotonClinico[data-id-metrica="${metricaActual}"]`);
            if (botonActualDOM) {
                botonActualDOM.style.animation = 'uroBlinkAnimation 0.8s infinite alternate';
            }

            if (typeof this.injectAnatomicalMetricAnnotation === 'function') {
                this.injectAnatomicalMetricAnnotation(metricaActual);
            }

            indiceTour = (indiceTour + 1) % tarjetasTour.length; 
        }, 3000);
    },

    ModoDiagnosticoSalida: function() {
        const graficoActivo = this.GraficoDiagnostico || this.chartFlujo;
        if (!graficoActivo) return;

        if (UroMxApp.state.idIntervaloFlechaAnimada) {
            clearInterval(UroMxApp.state.idIntervaloFlechaAnimada);
            UroMxApp.state.idIntervaloFlechaAnimada = null;
        }
        if (UroMxApp.state.idIntervaloTourAutomatico) {
            clearInterval(UroMxApp.state.idIntervaloTourAutomatico);
            UroMxApp.state.idIntervaloTourAutomatico = null;
        }

        if (graficoActivo.options.plugins?.annotation?.annotations) {
            graficoActivo.options.plugins.annotation.annotations = {};
        }
        
        if (this.GraficoDiagnostico && this.GraficoDiagnostico.options.plugins?.title) {
            this.GraficoDiagnostico.options.plugins.title.text = 'PARÁMETROS CLÍNICOS';
        }

        graficoActivo.update('none');

        if (UroMxApp.state.modoDiagnosticoActivo) {
            UroMxApp.state.modoDiagnosticoActivo = false;

            if (this.GraficoDiagnostico) {
                this.GraficoDiagnostico.destroy();
                this.GraficoDiagnostico = null;
            }

            const GraficoDiagnosticoContenedor = document.getElementById('GraficoDiagnosticoContenedor');
            if (GraficoDiagnosticoContenedor) GraficoDiagnosticoContenedor.remove();

            const panelKinderReal = document.getElementById('KinderContenedor') || document.querySelector('.KinderContenedor');
            if (panelKinderReal && panelKinderReal.style) {
                panelKinderReal.style.opacity = '1';
                panelKinderReal.style.pointerEvents = 'auto';
            }

            const tooltipFijoReal = typeof tooltipFlotante !== 'undefined' ? tooltipFlotante : document.getElementById('uro-tooltip-fijo-analitico');
            if (tooltipFijoReal && tooltipFijoReal.style) {
                tooltipFijoReal.style.opacity = '1';
                tooltipFijoReal.style.pointerEvents = 'auto';
            }

            // --- RESTAURACIÓN TOTAL DE LA BARRA LATERAL, ENGRANE Y CAFETERIA [STEM] ---
            const barraLateralDOM = document.querySelector('.sidebar');
            if (barraLateralDOM && barraLateralDOM.style) {
                barraLateralDOM.style.cursor = 'default';
                barraLateralDOM.querySelectorAll('.BotonMadre, .panel-acciones, button, aside').forEach(el => {
                    el.style.pointerEvents = 'auto';
                    el.style.cursor = 'default';
                });
                barraLateralDOM.querySelectorAll('.BotonMadre, .btn-clinico').forEach(b => b.style.cursor = 'pointer');
            }

            const panelCafeteriaDOM = document.getElementById('Cafeteria') || document.querySelector('.Cafeteria');
            if (panelCafeteriaDOM && panelCafeteriaDOM.style) {
                panelCafeteriaDOM.style.cursor = 'default';
                panelCafeteriaDOM.querySelectorAll('.BotonMadre').forEach(b => {
                    b.style.pointerEvents = 'auto';
                    b.style.cursor = 'pointer';
                });
            }

            const barraFiltrosDOM = document.getElementById('contenedor-filtros') || document.querySelector('.seccion-filtros');
            if (barraFiltrosDOM && barraFiltrosDOM.style) {
                barraFiltrosDOM.style.pointerEvents = 'auto';
                barraFiltrosDOM.style.cursor = 'default';
                barraFiltrosDOM.querySelectorAll('input, select, button').forEach(el => el.style.cursor = 'pointer');
            }

            document.querySelectorAll('.BotonClinico').forEach(c => { c.style.animation = 'none'; });
            console.log("UroMx Módulo 5: Entorno lateral restaurado al 100%.");
        }
    },


	buildAndDrawCanvasDiagnostico: function(tipo, idBuscado) {
        const idEntero = Math.floor(Number(idBuscado));
        const canvasModal = document.getElementById('canvas-diagnostico-espejo');
        if (!canvasModal) return;

        // 1. RECOLECCIÓN DE DATA PURA: Extraemos el vector cronológico de tu caché o DOM [STEM]
        let puntosDiagnostico = [];
        let etiquetaNombre = "";
        let colorLinea = UroMxApp.getColor(idEntero, true);
        const primerRegistro = UroMxApp.state.domFiltrado;

        if (UroMxApp.state.mode === 'MX') {
            if (tipo === 'MADRE') {
                const dataCachéDia = UroMxApp.state.cachedAverages?.porDia?.[idEntero.toString()];
                if (dataCachéDia && dataCachéDia.curva) {
                    const hijosDeEsteDia = UroMxApp.state.domFiltrado.filter(item => Math.floor(Number(item.idDia)) === idEntero);
                    const sumaTiempos = hijosDeEsteDia.reduce((acc, item) => acc + (Number(item.tiempo_seg) / 1000), 0);
                    const deltaT = (sumaTiempos / (hijosDeEsteDia.length || 1)) / (dataCachéDia.curva.length || 1);
                    puntosDiagnostico = dataCachéDia.curva.map((f, i) => ({ x: i * deltaT, y: f }));
                    etiquetaNombre = `Promedio Día ${idEntero}`;
                }
            } else {
                const regHijo = UroMxApp.state.domFiltrado.find(item => Number(item.idMix) === idEntero);
                if (regHijo && regHijo.flujo_mls) {
                    const deltaT = (Number(regHijo.tiempo_seg) / 1000) / (regHijo.flujo_mls.length || 1);
                    puntosDiagnostico = regHijo.flujo_mls.map((f, i) => ({ x: i * deltaT, y: f }));
                    etiquetaNombre = `Micción ${idEntero}`;
                }
            }
        } else {
            if (tipo === 'MADRE') {
                const dataCachéDil = UroMxApp.state.cachedAverages?.porDilatacion?.[idEntero.toString()];
                if (dataCachéDil && dataCachéDil.curva) {
                    const hijosDeEstaDil = UroMxApp.state.domFiltrado.filter(item => Math.floor(Number(item.idDilatacion)) === idEntero);
                    const sumaTiempos = hijosDeEstaDil.reduce((acc, item) => acc + (Number(item.tiempo_seg) / 1000), 0);
                    const deltaT = (sumaTiempos / (hijosDeEstaDil.length || 1)) / (dataCachéDil.curva.length || 1);
                    puntosDiagnostico = dataCachéDil.curva.map((f, i) => ({ x: i * deltaT, y: f }));
                    etiquetaNombre = `Promedio Dilatación ${idEntero}`;
                }
            } else {
                const dataCachéDiaHermano = UroMxApp.state.cachedAverages?.porDia?.[idEntero.toString()];
                if (dataCachéDiaHermano && dataCachéDiaHermano.curva) {
                    const hijosDeEsteDiaHermano = UroMxApp.state.domFiltrado.filter(item => Math.floor(Number(item.idDia)) === idEntero);
                    const sumaTiempos = hijosDeEsteDiaHermano.reduce((acc, item) => acc + (Number(item.tiempo_seg) / 1000), 0);
                    const deltaT = (sumaTiempos / (hijosDeEsteDiaHermano.length || 1)) / (dataCachéDiaHermano.curva.length || 1);
                    puntosDiagnostico = dataCachéDiaHermano.curva.map((f, i) => ({ x: i * deltaT, y: f }));
                    etiquetaNombre = `Día Hermano ${idEntero}`;
                }
            }
        }

        if (puntosDiagnostico.length === 0) return;

        // Destruimos cualquier instancia modal previa para no encimar gráficos en ráfaga [STEM]
        if (this.chartDiagnosticoEspejoInstance) {
            this.chartDiagnosticoEspejoInstance.destroy();
        }

        // 2. CONSTRUCCIÓN DEL LIENZO ESPEJO INDEPENDIENTE LIBRE DE MOSCAS
        // Este gráfico se auto-asienta strictly con tu conversión visual entre 10 en las etiquetas
        this.chartDiagnosticoEspejoInstance = new Chart(canvasModal, {
            type: 'line',
            data: {
                datasets: [{
                    label: etiquetaNombre,
                    data: puntosDiagnostico,
                    borderColor: colorLinea,
                    borderWidth: UroMxApp.constants.CurvaHGruesa || 3.0,
                    showLine: true,
                    tension: 0.4,
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                layout: { padding: { top: 10, left: 10, right: 15, bottom: 0 } },
                // Tu perfecta y limpia escala compacta sincronizada a paso de 10 enteros [STEM]
                scales: { 
                    x: { 
                        type: 'linear', position: 'bottom', offset: false, grace: 0, 
                        ticks: { padding: 0, callback: function(value) { return value >= 0 ? (value / 10).toFixed(1) : ''; }, stepSize: 10 }, 
                        title: { display: true, text: 'Tiempo [s]', padding: 0 } 
                    }, 
                    y: { 
                        type: 'linear', offset: false, grace: 0, 
                        title: { display: true, text: 'Volumen [mL]' } 
                    } 
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                    // Inicializamos el plugin de anotaciones vacío listo para recibir tus tarjetas
                    annotation: { annotations: {} }
                }
            }
        });

        console.log(`UroMx Módulo 5: Lienzo espejo de alta resolución calibrado para ${etiquetaNombre}.`);
    },

	// =========================================================================
    // FUNCIÓN AGRUAPA zoom, pinch y fullscreen
    // =========================================================================
    attachInteractiveGraphControls: function(canvas) {  //CLICKCHART INICIO
       	const contenedor = canvas.parentElement;
        if (!contenedor) return;

        if (UroMxApp.state.tooltipUltimoLeft === undefined) UroMxApp.state.tooltipUltimoLeft = null;
        if (UroMxApp.state.tooltipUltimoTop === undefined) UroMxApp.state.tooltipUltimoTop = null;

        let tooltipFlotante = contenedor.querySelector('#uro-tooltip-fijo-analitico');
        if (!tooltipFlotante) {
            tooltipFlotante = document.createElement('div');
            tooltipFlotante.id = 'uro-tooltip-fijo-analitico';
            
            tooltipFlotante.style.cssText = 'position:absolute; width:170px; border:0.1px; box-shadow:0 6px 16px rgba(0,0,0,0.25); border-radius:0px 0px 12px 12px; padding:0px; font-family:sans-serif; font-size:11px; color:#333; z-index:9999; pointer-events:auto; box-sizing:border-box; line-height:1.2; overflow:hidden;';
            
            if (UroMxApp.state.tooltipUltimoLeft !== null && UroMxApp.state.tooltipUltimoTop !== null) {
                // Si la memoria global tiene píxeles guardados, nace exactamente ahí
                tooltipFlotante.style.left = UroMxApp.state.tooltipUltimoLeft;
                tooltipFlotante.style.top = UroMxApp.state.tooltipUltimoTop;
                tooltipFlotante.style.right = 'auto';
            } else {
                // Si es la primera vez que carga en frío, se acomoda en tu esquina de nacimiento por defecto
                tooltipFlotante.style.right = '15px';
                tooltipFlotante.style.top = '15px';
            } 

            tooltipFlotante.innerHTML = `
				<div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; background-color:#34495e; color:#ffffff; height:26px; padding:0 8px; text-transform:uppercase; font-size:10px; user-select:none; border-bottom:1px solid #2c3e50;">
				    <span>Lectura Clínica</span>
				    <button id="uro-btn-cerrar-tooltip" style="background: none; border: none; font-size: 15px; cursor: pointer; color: #adb5bd; padding: 0; line-height: 1;" title="Cerrar ventana">×</button>
				</div>
				<div id="uro-tooltip-contenido" style="padding:8px 10px; color:#333; font-size:12px; background-color:#f1f5f9;">
				    Mueva el puntero...
				</div>
            `;
            contenedor.appendChild(tooltipFlotante);

            const btnCerrar = tooltipFlotante.querySelector('#uro-btn-cerrar-tooltip');
            if (btnCerrar) {
                btnCerrar.onmousedown = (e) => e.stopPropagation();
                btnCerrar.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    tooltipFlotante.style.display = 'none';
                    console.log("UroMx Módulo 5: Tooltip flotante cerrado.");
                };
            }

            // --- 📍 MOTOR DE ARRASTRE PARA PC: LIBRE EN TODA LA PANTALLA DEL NAVEGADOR ---
            tooltipFlotante.onmousedown = (ev) => {
                if (ev.target.id === 'uro-btn-cerrar-tooltip') return;
                ev.preventDefault();
                
                const cajaReal = tooltipFlotante.getBoundingClientRect();
                const desfasamientoInternoX = ev.clientX - cajaReal.left;
                const desfasamientoInternoY = ev.clientY - cajaReal.top;
                
                document.onmousemove = (movEv) => {
                    movEv.preventDefault();
                    
                    const anchoNavegador = window.innerWidth;
                    const altoNavegador = window.innerHeight;
                    const contenedorGrafico = contenedor.getBoundingClientRect();

                    let xFisicaPantalla = movEv.clientX - desfasamientoInternoX;
                    let yFisicaPantalla = movEv.clientY - desfasamientoInternoY;

                    // ENJAULADO TOTAL VIEWPORT: Impide que salga de los limites del navegador
                    xFisicaPantalla = Math.max(0, Math.min(anchoNavegador - cajaReal.width, xFisicaPantalla));
                    yFisicaPantalla = Math.max(0, Math.min(altoNavegador - cajaReal.height, yFisicaPantalla));

                    const pxRelativoLeft = xFisicaPantalla + window.scrollX - contenedorGrafico.left;
                    const pxRelativoTop = yFisicaPantalla + window.scrollY - contenedorGrafico.top;

                    tooltipFlotante.style.left = `${pxRelativoLeft}px`;
                    tooltipFlotante.style.top = `${pxRelativoTop}px`;
                    tooltipFlotante.style.right = 'auto';
                };

                document.onmouseup = () => {
                    UroMxApp.state.tooltipUltimoLeft = tooltipFlotante.style.left;
                    UroMxApp.state.tooltipUltimoTop = tooltipFlotante.style.top;
                    
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };

            // --- 📍 MOTOR DE ARRASTRE PARA CELULAR: LIBRE EN TODA LA PANTALLA ---
            tooltipFlotante.addEventListener('touchstart', (ev) => {
                if (ev.target.id === 'uro-btn-cerrar-tooltip') return;
                if (ev.touches.length > 1) return;
                
                const toqueInicial = ev.touches[0];
                const cajaReal = tooltipFlotante.getBoundingClientRect();
                const desfasamientoInternoX = toqueInicial.clientX - cajaReal.left;
                const desfasamientoInternoY = toqueInicial.clientY - cajaReal.top;

                const moverTooltipTactil = (movEv) => {
                    if (movEv.touches.length > 1) return;
                    movEv.preventDefault();
                    
                    const toqueActual = movEv.touches[0];
                    const anchoNavegador = window.innerWidth;
                    const altoNavegador = window.innerHeight;
                    const contenedorGrafico = contenedor.getBoundingClientRect();

                    let xFisicaPantalla = toqueActual.clientX - desfasamientoInternoX;
                    let yFisicaPantalla = toqueActual.clientY - desfasamientoInternoY;

                    xFisicaPantalla = Math.max(0, Math.min(anchoNavegador - cajaReal.width, xFisicaPantalla));
                    yFisicaPantalla = Math.max(0, Math.min(altoNavegador - cajaReal.height, yFisicaPantalla));

                    const pxRelativoLeft = xFisicaPantalla + window.scrollX - contenedorGrafico.left;
                    const pxRelativoTop = yFisicaPantalla + window.scrollY - contenedorGrafico.top;

                    tooltipFlotante.style.left = `${pxRelativoLeft}px`;
                    tooltipFlotante.style.top = `${pxRelativoTop}px`;
                    tooltipFlotante.style.right = 'auto';
                };

                const detenerTooltipTactil = () => {
                    UroMxApp.state.tooltipUltimoLeft = tooltipFlotante.style.left;
                    UroMxApp.state.tooltipUltimoTop = tooltipFlotante.style.top;

                    contenedor.removeEventListener('touchmove', moverTooltipTactil);
                    contenedor.removeEventListener('touchend', detenerTooltipTactil);
                };

                contenedor.addEventListener('touchmove', moverTooltipTactil, { passive: false });
                contenedor.addEventListener('touchend', detenerTooltipTactil);
            }, { passive: true });        
        } else {
            tooltipFlotante.style.display = 'block';
            
            if (UroMxApp.state.tooltipUltimoLeft !== null && UroMxApp.state.tooltipUltimoTop !== null) {
                tooltipFlotante.style.left = UroMxApp.state.tooltipUltimoLeft;
                tooltipFlotante.style.top = UroMxApp.state.tooltipUltimoTop;
                tooltipFlotante.style.right = 'auto';
            } else {
                tooltipFlotante.style.left = '';
                tooltipFlotante.style.top = '15px';
                tooltipFlotante.style.right = '15px';
            }
        }
        // --- 📍 CONTROL DEL PINCH, ZOOM Y FULLSCREEN RECTIFICADO ---
        let ultimoToqueTiempo = 0;

        const conmutarPantallaYResetZoom = (e) => {
            if (e) e.preventDefault();
            
            if (this.chartFlujo && typeof this.chartFlujo.resetZoom === 'function') {
                this.chartFlujo.resetZoom();
                console.log("UroMx Modulo 5: Zoom reseteado al centro.");
            }

            const esNativo = document.fullscreenElement === contenedor;
            const esVirtual = contenedor.classList.contains('uro-fullscreen-virtual-movil');

            if (!esNativo && !esVirtual) {
                if (contenedor.requestFullscreen) {
                    contenedor.requestFullscreen().then(() => {
                        if (window.screen.orientation?.lock) window.screen.orientation.lock('landscape').catch(() => {});
                    }).catch(() => activarEspejoVirtual());
                } else {
                    activarEspejoVirtual();
                }
            } else {
                if (document.fullscreenElement) {
                    if (document.exitFullscreen) document.exitFullscreen();
                } else {
                    apagarEspejoVirtual();
                }
            }

            function activarEspejoVirtual() {
                contenedor.classList.add('uro-fullscreen-virtual-movil');
                contenedor.style.cssText = 'position:fixed; left:0; top:0; width:100vw; height:100vh; background:#fff; padding:15px; box-sizing:border-box; z-index:99999999; cursor:zoom-out;';
                canvas.style.setProperty('height', '85vh', 'important');
                if (UroMxApp.ChartManager.chartFlujo) UroMxApp.ChartManager.chartFlujo.resize();
            }

            function apagarEspejoVirtual() {
                contenedor.classList.remove('uro-fullscreen-virtual-movil');
                //canvas.style.setProperty('height', '350px', 'important');
                if (UroMxApp.ChartManager.chartFlujo) UroMxApp.ChartManager.chartFlujo.resize();
            }
        };

        contenedor.ondblclick = (e) => conmutarPantallaYResetZoom(e);

        // --- 📍 ANCLAJE SENSORIAL UNIFICADO PARA CELULARES (SÍN DUPLICACIONES) [STEM] ---
        // Capturamos el dedo en el canvas para double-tap y arrastre sostenido simultáneo libre de colisiones
        canvas.addEventListener('touchstart', (e) => {
            // Activamos de inmediato el sensor de presión sostenida en tu estado global
            UroMxApp.state.mouseEstaPresionadoSostenido = true;

            if (e.touches.length > 1) return; 

            const tiempoActual = new Date().getTime();
            const diferencia = tiempoActual - ultimoToqueTiempo;
            ultimoToqueTiempo = tiempoActual;

            if (diferencia < 280 && diferencia > 0) {
                conmutarPantallaYResetZoom(e);
            }
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            // Apagamos el sensor de presión al levantar el dedo y forzamos refresco terso
            UroMxApp.state.mouseEstaPresionadoSostenido = false;
            if (this.chartFlujo) this.chartFlujo.update('none');
        }, { passive: true });


        // --- 📍 RASTREADOR FÍSICO DE CLIC SOSTENIDO PARA PC ---
        UroMxApp.state.mouseEstaPresionadoSostenido = false;

        contenedor.onmousedown = (e) => {
            if (e.button === 0) UroMxApp.state.mouseEstaPresionadoSostenido = true;
        };

        contenedor.onmouseup = () => {
            UroMxApp.state.mouseEstaPresionadoSostenido = false;
            if (this.chartFlujo) this.chartFlujo.update('none');
        };


        // --- 📍 MONITOR ESCAPE DE TECLADO PC (CANDADO DE RESGUARDO ANTIBUCLE) ---
        document.onfullscreenchange = () => {
            if (!document.fullscreenElement) {
                contenedor.style.cssText = '';
                canvas.style.removeProperty('height');                
                
                // --- 📍 PARCHE CRONOMÉTRICO: Blindamos el redibujo contra desfases de Grid [1.3] ---
                setTimeout(() => {
                    if (this.chartFlujo) {
                        this.chartFlujo.resize();
                        if (typeof this.chartFlujo.resetZoom === 'function') {
                            this.chartFlujo.resetZoom('none');
                        }
                        this.chartFlujo.update('none'); // Refresco visual instantáneo y simétrico [1.3]
                    }
                }, 40); // 40ms es invisible para el urólogo pero vital para la memoria RAM
                
                console.log("UroMx Módulo 5: Candado físico inyectado. Bucle de re-escalado destruido en PC.");
            } else {
                contenedor.style.cssText = 'background:#ffffff; padding:25px; cursor:zoom-out; width:100vw !important; height:100vh !important; position:fixed; left:0; top:0; z-index:9999999;';
                canvas.style.setProperty('height', '85vh', 'important');
                
                setTimeout(() => {
                    if (this.chartFlujo) this.chartFlujo.resize();
                }, 40);
            }
        };
    }
};


// 4. CONFIGURACIÓN DEL ESTADO POR DEFECTO Y CIERRE GLOBAL
UroMxApp.loadDefaultState = function() {
    this.state.selectedMothers.clear(); 
    this.state.selectedChildren.clear(); // CORREGIDO: Nace 100% vacío para que los hijos arranquen en OFF
    
    if (this.state.domFiltrado && this.state.domFiltrado.length > 0) {
        // Capturamos el primer elemento (idMix = 0) para identificar su familia de tu PHP
        const itemCero = this.state.domFiltrado[0];
        
        if (itemCero) {
            // REGLA DE NACIMIENTO: Enciende en automático únicamente la madre que lo agrupa (0.1 -> 0)
            const idMadreInicial = this.state.mode === 'MX' ? Math.floor(Number(itemCero.idDia)) : Number(itemCero.idDilatacion);
            this.state.selectedMothers.add(idMadreInicial);

            // CORREGIDO: Inyectamos la identidad de nacimiento exacta en el lastContext para que no nazca en null [STEM]
            this.state.lastContext = {
                contexto: 'NORMAL_MADRE',
                id: idMadreInicial,
                origen: 'NORMAL_MADRE'
            };

            // Mandamos los silbatazos en cadena inmediatos en limpio sin retrasos de tiempo
            if (UroMxApp.CalculationsManager && typeof UroMxApp.CalculationsManager.processCalculations === 'function') {
                UroMxApp.CalculationsManager.processCalculations('NORMAL_MADRE', idMadreInicial);
            }
            if (UroMxApp.ChartManager && typeof UroMxApp.ChartManager.renderChartPipeline === 'function') {
                UroMxApp.ChartManager.renderChartPipeline();
            }
        }
    }
    
    // Forzamos el silbatazo de arranque para que la tubería de interacciones despierte con el origen correcto
    UroMxApp.state.lastContext = { contexto: 'INIT', id: null, origen: 'ORIGEN_MADRE' };

    if (this.InteractionManager) {
        this.InteractionManager.rebuildInterfacePipeline();
    }
};


UroMxApp.CalculationsManager = {
    processCalculations: function(contexto, id) {
        const tituloElemento = document.getElementById('titulo-calculos') || 
                               document.querySelector('.seccion-calculos h3') ||
                               document.querySelector('.calculos-container h3') ||
                               document.querySelector('h3');

        const ctx = UroMxApp.state.lastContext || { contexto: null, id: null, origen: 'ORIGEN_MADRE' };
        let textoFinal = "Promedio de micciones último día registrado.";
        const madresON = Array.from(UroMxApp.state.selectedMothers);
        const hijosON = Array.from(UroMxApp.state.selectedChildren);
    

        // CONFIGURACIÓN DE LEYENDAS HISTÓRICAS DE TRIPLE CLIC
        if (contexto === 'TRIPLE_MADRE') {
            const miccionesTotales = UroMxApp.state.domFiltrado.length;
            const diasTotalesSet = new Set();
            UroMxApp.state.domFiltrado.forEach(item => diasTotalesSet.add(Math.floor(Number(item.idDia))));
            const dilsSet = new Set();
            UroMxApp.state.domFiltrado.forEach(item => dilsSet.add(Math.floor(Number(item.idDilatacion))));
                
            
            textoFinal = UroMxApp.state.mode === 'MX' 
                ? `Promedio del historial completo: ${miccionesTotales} micciones en ${diasTotalesSet.size} días.`
                : `Promedio del historial completo: ${miccionesTotales} micciones en ${dilsSet.size} dilataciones.`; 
        } 
        else if (contexto === 'TRIPLE_HIJO') {
            const totalMadresActivas = UroMxApp.state.selectedMothers.size;
            let conteoMiccionesKinder = 0;
            UroMxApp.state.selectedMothers.forEach(mId => {
                const prom = UroMxApp.state.mode === 'MX' 
                    ? UroMxApp.state.cachedAverages.porDia[mId.toString()]
                    : UroMxApp.state.cachedAverages.porDilatacion[mId.toString()];
                if (prom) conteoMiccionesKinder += prom.totalMicciones;
            });
            
            textoFinal = UroMxApp.state.mode === 'MX'
                ? `Promedio de las ${conteoMiccionesKinder} micciones de los ${totalMadresActivas} días seleccionados.`
                : `Promedio de las ${conteoMiccionesKinder} micciones de las ${totalMadresActivas} dilataciones seleccionadas.`;
        } 
        else {

            // A) CASO NACIMIENTO: Resguardo inicial (idMix = 0)
            if (madresON.length === 0 && hijosON.length === 0) {
                const itemCero = UroMxApp.state.domFiltrado.find(i => i.idMix === 0) || UroMxApp.state.domFiltrado;
                textoFinal = `Última micción registrada: ${itemCero?.fecha || ''}`;
            } 
            // B) FOCO EXCLUSIVO EN MADRE AL PASAR A ON (1 ó 2 CLICS)
            else if (ctx.contexto === 'NORMAL_MADRE') {
                if (UroMxApp.state.mode === 'MX') {
                    const primerHijo = UroMxApp.state.domFiltrado.find(item => Math.floor(Number(item.idDia)) === ctx.id);
                    const promData = UroMxApp.state.cachedAverages.porDia[ctx.id.toString()];
                    textoFinal = `Promedio de ${promData ? promData.totalMicciones : 0} micciones del ${primerHijo?.fecha?.substring(0, 10) || ''}.`;
                } else {
                    const promData = UroMxApp.state.cachedAverages.porDilatacion[ctx.id.toString()];
                    
                    // --- EXTRAEMOS EL CALIBRE DE SONDA DE LA MADRE ACTIVA ---
                    const registroMadreDI = UroMxApp.state.domFiltrado.find(item => Math.floor(Number(item.idDilatacion)) === ctx.id);
                    const SondaMadreActual = registroMadreDI?.frSonda ? `: ${registroMadreDI.frSonda}Fr` : '';

                    // TU NUEVA LÍNEA INTERCALADA CON LA VARIABLE:
                    textoFinal = `Promedio de ${promData ? promData.totalMicciones : 0} micciones de la dilatación #${ctx.id}${SondaMadreActual}.`;
                }
            } 
            // C) FOCO EXCLUSIVO EN HIJO AL PASAR A ON (1 ó 2 CLICS)
            else if (ctx.contexto === 'NORMAL_HIJO') {
                if (UroMxApp.state.mode === 'MX') {
                    const hijoActivo = UroMxApp.state.domFiltrado.find(item => item.idMix === ctx.id);
                    textoFinal = `Micción del ${hijoActivo?.fecha || ''}`;
                } else {
                    // En Modo DI el ctx.id es el entero del idDia. Filtramos las micciones de ese día hermano
                    const miccionesDelDiaHermano = UroMxApp.state.domFiltrado.filter(item => Math.floor(Number(item.idDia)) === ctx.id && UroMxApp.state.selectedMothers.has(Math.floor(Number(item.idDilatacion))));
                    const primerRegistro = miccionesDelDiaHermano[0];
                    // Tomamos la primera madre activa para reportar el ID de la Dilatación
                    const madreActivaId = madresON[0] || '';

                    const registroConSonda = miccionesDelDiaHermano[0] || item;
                    const SondaActual = registroConSonda.frSonda ? `: ${registroConSonda.frSonda}Fr` : '';
                    
                    // TU NUEVA LÍNEA INTERCALADA CON LA VARIABLE COMPLETA:
                    textoFinal = `Promedio de ${miccionesDelDiaHermano.length} micciones del ${primerRegistro?.fecha?.substring(0, 10) || ''} en la dilatación #${madreActivaId}${SondaActual}.`;

                }
            } 
            // D) PROMEDIO RESIDUAL AL APAGAR UNA MADRE (MADRE_PASO_A_OFF)
            else if (ctx.contexto === 'MADRE_PASO_A_OFF' && madresON.length > 0) {
                let comboMicciones = 0;
                madresON.forEach(mId => {
                    const promData = UroMxApp.state.mode === 'MX' 
                        ? UroMxApp.state.cachedAverages.porDia[mId.toString()]
                        : UroMxApp.state.cachedAverages.porDilatacion[mId.toString()];
                    if (promData) comboMicciones += promData.totalMicciones;
                });
                
                textoFinal = UroMxApp.state.mode === 'MX'
                    ? `Promedio de ${comboMicciones} micciones en ${madresON.length} días seleccionados.`
                    : `Promedio de ${comboMicciones} micciones en ${madresON.length} dilataciones seleccionadas.`;
            } 
            // E) PROMEDIO RESIDUAL AL APAGAR UN HIJO (HIJO_PASO_A_OFF)
            else if (ctx.contexto === 'HIJO_PASO_A_OFF' && hijosON.length > 0) { 
                if (UroMxApp.state.mode === 'MX') {
                    // --- INCISIÓN 1: APAGADO RESIDUAL DE HIJO MODO MX (CONTRAL DE CASOS A, B Y C) ---
                    // Obtenemos los días (madres) de los hijos sobrevivientes para evaluar si son hermanos o de diferentes días
                    const diasDeHijosSobrevivientes = new Set();
                    let conteoMiccionesDiferentesDias = 0;
                    let primerRegistroHijo = null;

                    hijosON.forEach(hId => {
                        const reg = UroMxApp.state.domFiltrado.find(i => i.idMix === hId);
                        if (reg) {
                            diasDeHijosSobrevivientes.add(Math.floor(Number(reg.idDia)));
                            if (!primerRegistroHijo) primerRegistroHijo = reg;
                            conteoMiccionesDiferentesDias++;
                        }
                    });

                    const fechaFormatoLargo = primerRegistroHijo ? primerRegistroHijo.fecha.substring(0, 10) : '';

                    if (hijosON.length === 1) {
                        // CASO A: Sólo queda un hijo seleccionado (Micción individual pura)
                        textoFinal = `Micción del ${fechaFormatoLargo}`;
                    } 
                    else if (diasDeHijosSobrevivientes.size === 1) {
                        // CASO B: Queda más de uno pero son HERMANOS (mismo día entero)
                        textoFinal = `Promedio de ${hijosON.length} micciones del ${fechaFormatoLargo}`;
                    } 
                    else {
                        // CASO C: Quedan más de uno pero de MADRES DIFERENTES (días cruzados)
                        textoFinal = `Promedio de ${conteoMiccionesDiferentesDias} micciones de ${diasDeHijosSobrevivientes.size} diferentes días`;
                    }

                } else {
                    // Modo DI Sincronizado: Sumamos micciones de los días hermanos que pertenecen a las dilataciones seleccionadas
                    let totalMiccionesResidualesDI = 0;
                    
                    hijosON.forEach(diaId => {
                        const registrosDelDia = UroMxApp.state.domFiltrado.filter(item => {
                            const idMadreEntero = Math.floor(Number(item.idDilatacion));
                            const idDiaEntero = Math.floor(Number(item.idDia));
                            // REGLA: Cuenta el registro sólo si su madre y su día hermano están encendidos en simultáneo
                            return idDiaEntero === diaId && UroMxApp.state.selectedMothers.has(idMadreEntero);
                        });
                        totalMiccionesResidualesDI += registrosDelDia.length;
                    });
                    
                    const primerDiaHermanoDI = UroMxApp.state.domFiltrado.find(item => Math.floor(Number(item.idDia)) === hijosON[0]);
                    const fechaCortaDI = primerDiaHermanoDI ? primerDiaHermanoDI.fecha.substring(0, 10) : '';
                    // --- TU CÓDIGO NATIVO EN EL SERVIDOR (INTACTO): ---
                    textoFinal = hijosON.length === 1
                        ? `Promedio de ${totalMiccionesResidualesDI} micciones del día ${fechaCortaDI}` 
                        : `Promedio de ${totalMiccionesResidualesDI} micciones en ${hijosON.length} días seleccionados`; 
                }
            }
        } // --- Aquí cierra la gran compuerta A de tus botones clínicos

        // =========================================================================
        // --- 📍 INCISIÓN DE ACUPUNTURA CORREGIDA Y BLINDADA (MÓDULO 5) [STEM] ---
        // =========================================================================
        // Validamos si hay una tarjeta parpadeando activa en la memoria global
        const mActivaLimpia = UroMxApp.state.botonClinicoActivo;
        
        if (mActivaLimpia && textoFinal) {
            let nombreMétricaDOM = "Métrica Activa";
            
            // CORREGIDO: Usamos tu ruta exacta del elemento cero [0] que descubriste en la consola
            if (UroMxApp.state.domFiltrado && UroMxApp.state.domFiltrado.length > 0) {
                const primerRegistroConDatos = UroMxApp.state.domFiltrado[0];
                if (primerRegistroConDatos && primerRegistroConDatos.calculos && primerRegistroConDatos.calculos[mActivaLimpia]) {
                    nombreMétricaDOM = primerRegistroConDatos.calculos[mActivaLimpia].nombre || nombreMétricaDOM;
                }
            }

            // Aplicamos tu regla algorítmica perfecta para rebanar la "P" y armar el prefijo mutante
            const primerNumeroEncontrado = textoFinal.match(/\d+/);
            
            if (textoFinal.trim().startsWith('P')) {
                if (primerNumeroEncontrado) {
                    const idNum = textoFinal.indexOf(primerNumeroEncontrado);
                    textoFinal = `${nombreMétricaDOM}: ${textoFinal.substring(idNum)}`;
                } else {
                    textoFinal = `${nombreMétricaDOM}: ${textoFinal.substring(1).trim().toLowerCase()}`;
                }
            } else {
                textoFinal = `${nombreMétricaDOM}: ${textoFinal.toLowerCase()}`;
            }
        }

        // --- TU CÓDIGO NATIVO DE INYECCIÓN DE PANTALLA E INTERFAZ (INTACTO): ---
        if (tituloElemento) {
            tituloElemento.innerText = textoFinal;
        }

        // CONTINUACIÓN DIRECTA HACIA EL RENDER DE TARJETAS (NUESTRAS TRIPAS PERFECTAS)
        const registrosActivos = this.extractActiveDataRecords(ctx.origen, madresON, hijosON);
        
        this.renderClinicalCards(registrosActivos);
    },


    extractActiveDataRecords: function(origen, madresON, hijosON) {
        const ctx = UroMxApp.state.lastContext || { contexto: null, id: null };

        // --- SECCIÓN A: CASOS HISTÓRICOS DE TRIPLE CLIC (INTACTOS) ---
        if (ctx.contexto === 'TRIPLE_MADRE') {
            return [...UroMxApp.state.domFiltrado];
        }
        if (ctx.contexto === 'TRIPLE_HIJO') {
            return UroMxApp.state.domFiltrado.filter(item => {
                const rawM = UroMxApp.state.mode === 'MX' ? item.idDia : item.idDilatacion;
                return UroMxApp.state.selectedMothers.has(Math.floor(Number(rawM)));
            });
        }

        // --- SECCIÓN B: REGLA DE FOCO EXCLUSIVO EN EL ENCENDIDO (ON) ---
if (ctx.contexto === 'NORMAL_MADRE' && UroMxApp.state.selectedMothers.has(ctx.id)) {
    return UroMxApp.state.domFiltrado.filter(item => {
        const rawM = UroMxApp.state.mode === 'MX' ? item.idDia : item.idDilatacion;
        return Math.floor(Number(rawM)) === ctx.id;
    });
}
if (ctx.contexto === 'NORMAL_HIJO' && UroMxApp.state.selectedChildren.has(ctx.id)) {
    return UroMxApp.state.domFiltrado.filter(item => item.idMix === ctx.id);
}
    
        // --- SECCIÓN C: REGLA DE PROMEDIO RESIDUAL AL APAGAR UN BOTÓN (OFF) ---
        // Si el flujo llega aquí, significa que la última acción fue un apagado (OFF).
        // Por lo tanto, calculamos el promedio acumulado de lo que sobrevivió encendido.
        if (origen === 'ORIGEN_HIJO' && hijosON.length > 0) {
            return UroMxApp.state.domFiltrado.filter(item => hijosON.includes(item.idMix));
        }
        if (madresON.length > 0) {
            return UroMxApp.state.domFiltrado.filter(item => {
                const rawM = UroMxApp.state.mode === 'MX' ? item.idDia : item.idDilatacion;
                return madresON.includes(Math.floor(Number(rawM)));
            });
        }
        
        // Resguardo de nacimiento (idMix = 0)
        const itemCero = UroMxApp.state.domFiltrado.find(i => i.idMix === 0);
        return itemCero ? [itemCero] : [];
    },


    // 3. RENDERIZADO UNIVERSAL Y AUTOMATIZADO DE TODAS LAS TARJETAS CLÍNICAS (CORREGIDO)
    renderClinicalCards: function(registros) {
        const BotonClinicoContenedor = document.getElementById('BotonClinicoContenedor');
                           
        if (!BotonClinicoContenedor) return;
        BotonClinicoContenedor.innerHTML = ''; 
		BotonClinicoContenedor.style.display = 'grid';
		BotonClinicoContenedor.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
		BotonClinicoContenedor.style.gap = '2px';
		BotonClinicoContenedor.style.width = '100%';

        if (!registros || registros.length === 0) return;

        // BotonClinicoContenedor GRID RESPONSIVO (IGUAL A TU DISPOSICIÓN VISUAL)
        const gridTarjetas = document.createElement('div');
        gridTarjetas.style.display = 'grid';
        gridTarjetas.style.gridTemplateColumns = 'repeat(auto-fit, minmax(150px, 1fr))';
        gridTarjetas.style.gap = '12px';
        gridTarjetas.style.width = '100%';

        const acumuladorMetricas = {};
        let conteoConCalculos = 0;

        // Recorrer los registros activos para agrupar dinámicamente todo lo que venga de PHP
        registros.forEach(item => {
            if (item.calculos) {
                conteoConCalculos++;
                for (const llavePuraPHP in item.calculos) {
                    const datosParametro = item.calculos[llavePuraPHP];
                    
                    if (datosParametro) {
                        // REGLA CORREGIDA: La llave de identidad es el ID limpio de tu PHP (ej: 'Qmax', 'Vvoid', 'Vdrop')
                        const llaveUnica = llavePuraPHP; 
                        
                        if (!acumuladorMetricas[llaveUnica]) {
                            acumuladorMetricas[llaveUnica] = {
                                idTecnicoLimpio: llaveUnica, // Guardamos 'Vvoid' o 'Vdrop' directo
                                nomenclatura: datosParametro.nomenclatura,
                                nombre: datosParametro.nombre || llaveUnica,
                                unidad: datosParametro.unidad || '',
                                sumaValor: 0,
                                explicacion: datosParametro.explicacion || 'Sin descripción.',
                                explicacion_paciente: datosParametro.explicacion_paciente || 'Sin descripción.',
                                ordenServidor: Number(datosParametro.orden ?? -1),                            
                            	semaforo: datosParametro.semaforo || "verde",
                                rangoNormal: datosParametro.rangos_normales || 'Clínico estándar'
                            };
                        }
                        // Limpiamos las comas del number_format de PHP para poder sumarlo numéricamente en JS
                        const valorLimpioNum = Number(datosParametro.valor.toString().replace(/,/g, '') || 0);
                        acumuladorMetricas[llaveUnica].sumaValor += valorLimpioNum;
                    }
                }
            }
        });

        // 2. DIBUJAR LAS TARJETAS USANDO EL ID LIMPION DE TU PHP
        for (const llaveIdLimpio in acumuladorMetricas) {
            const metrica = acumuladorMetricas[llaveIdLimpio];
            const promedioFinal = (metrica.sumaValor / (conteoConCalculos || 1)).toFixed(3); // Tus 3 decimales



            const BotonClinico = document.createElement('div');
            BotonClinico.className = 'BotonClinico';
            const hexA_Rgb = (hex) => hex.startsWith('#') ? `${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)}` : '40, 167, 69';
            let colorSemaforo = '#2ecc71'; // Verde por defecto
            const semaforoRealPHP = metrica.semaforo || '';
            if (semaforoRealPHP === 'ambar') colorSemaforo = '#f1c40f';
            if (semaforoRealPHP === 'rojo')  colorSemaforo = '#e74c3c';
            
            // --- DISEÑO FÍSICO DE LA TARJETA (REPLACING CODE) ---
            BotonClinico.dataset.idMetrica = llaveIdLimpio;
        	BotonClinico.style.backgroundColor = `rgba(${hexA_Rgb(colorSemaforo)}, 0.18)`;
            BotonClinico.style.border = `2px solid ${colorSemaforo}`;
        	BotonClinico.style.borderTop = `8px solid ${colorSemaforo}`;
            BotonClinico.style.height = '70px'; 
            BotonClinico.style.padding = '2px 4px'; 
            BotonClinico.style.borderRadius = '0 0 12px 12px';
            BotonClinico.style.position = 'relative';
            BotonClinico.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
            BotonClinico.style.boxSizing = 'border-box'; 
            
            BotonClinico.style.display = 'flex';
            BotonClinico.style.flexDirection = 'column';
            BotonClinico.style.justifyContent = 'space-between'; 

            if (UroMxApp.state.botonClinicoActivo === llaveIdLimpio) {
                BotonClinico.style.animation = 'uroBlinkAnimation 1.8s infinite alternate';
            } else {
                BotonClinico.style.animation = 'none';
                BotonClinico.style.opacity = '1';
            }  

            // =========================================================================
            // --- 📍 CONTROL REMOTO BIÓNICO: ANOTACIONES AL PASAR EL PUNTERO [STEM] ---
            // =========================================================================
            // Al entrar el puntero, le pasamos el ID técnico limpio (ej: 'Vvoid', 'Qave', 
        	BotonClinico.onmouseenter = () => {
                BotonClinico.style.animation = 'uroBlinkAnimation 1.8s infinite alternate';
            	if (UroMxApp.ChartManager && typeof UroMxApp.ChartManager.injectAnatomicalMetricAnnotation === 'function') {
                    clearInterval(UroMxApp.state.idIntervaloTourAutomatico);
                	UroMxApp.ChartManager.injectAnatomicalMetricAnnotation(llaveIdLimpio);
                }
            };

            // Al salir el puntero, borramos las marcas instantáneamente regresando el lienzo a su silueta elástica limpia
            BotonClinico.onmouseleave = () => {
                BotonClinico.style.animation = 'none';
                BotonClinico.style.opacity = '1';
                if (UroMxApp.state.modoDiagnosticoActivo) {
                    clearInterval(UroMxApp.state.idIntervaloTourAutomatico);// Si el diagnóstico está operando, SÓLO limpia la geometría, NO destruye el búnker [STEM]
                    if (UroMxApp.ChartManager && UroMxApp.ChartManager.chartDiagnosticoLimpio) {
                        const graficoHijo = UroMxApp.ChartManager.chartDiagnosticoLimpio;
                        if (graficoHijo.options.plugins?.annotation?.annotations) {
                            graficoHijo.options.plugins.annotation.annotations = {};
                            graficoHijo.update('none');
                        }
                    }
                } else {
                    if (UroMxApp.ChartManager && typeof UroMxApp.ChartManager.ModoDiagnosticoSalida === 'function') {
                        UroMxApp.ChartManager.ModoDiagnosticoSalida();
                    }
                }
            };

            // --- INYECCIÓN VISUAL DEL CONTENIDO (INTERCALADO CON EXPLICACIONES) ---
            BotonClinico.innerHTML = `
                <!-- Bloque Superior: Nomenclatura e Icono i -->
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div style="font-size:15px; font-weight:bold; color:#000; font-family:sans-serif; line-height:1;">
                        ${metrica.nomenclatura}
                    </div>                    
                    <button class="btn-i-flotante-real"style="width: 16px; height: 16px;border-radius: 50%;background-color: rgba(0, 0, 0, 0.1);color: white; border: none;font-size: 12px;font-weight: bold;font-style: italic;cursor: pointer;display: flex;align-items: center;justify-content: center;transition: background-color 0.3s ease;" title="Info">?</button>
                </div>
                
                <!-- Bloque Central: Nombre Técnico -->
                <!-- Nota: Reducimos el margin vertical a 2px y quitamos min-height para pegar los elementos verticalmente -->
                <div style="font-size:11px; color:#555; margin:2px 0; line-height:1.1; width:85%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${metrica.nombre}
                </div>
                
                <!-- Bloque Inferior: Valor Clínico y Unidad -->
                <!-- Nota: Cambiamos text-align:right a left/center si no quieres que salga disparado tan a la derecha -->
                <div style="text-align:right; font-size:22px; font-weight:800; color:#000; line-height:1; margin-top:2px; margin-right:">
                    ${promedioFinal} <span style="font-size:12px; font-weight:normal; color:#666; margin-right:6px;">${metrica.unidad}</span>
                </div>
            `;


            BotonClinico.querySelector('.btn-i-flotante-real').onclick = (ev) => {
                ev.stopPropagation(); 
                this.openPatientEducationalPanel(metrica.nombre, metrica.unidad, metrica.explicacion, metrica.explicacion_paciente, metrica.rangoNormal);
            };

            // --- CABLEADO DEL CLIC CLÍNICO CON EL ID LIMPIO DE TU PHP ---
            BotonClinico.style.cursor = 'pointer';
            BotonClinico.onclick = (e) => {
                if (e.target.classList.contains('btn-i-flotante-real')) return;
                e.preventDefault();
                
                console.log(`UroMx: Guardando en memoria el ID limpio de tu PHP -> ${llaveIdLimpio}`);

                // Guardamos en el estado el ID puro ('Qmax', 'Vvoid', 'Vdrop')
                if (UroMxApp.state.botonClinicoActivo === llaveIdLimpio) {
                    UroMxApp.state.botonClinicoActivo = null; // Apaga (OFF)
                } else {
                    UroMxApp.state.botonClinicoActivo = llaveIdLimpio; // Enciende (ON)
                }

                // Sincronización instantánea de la interfaz
                UroMxApp.CalculationsManager.processCalculations(UroMxApp.state.lastContext?.contexto, UroMxApp.state.lastContext?.id);
                UroMxApp.ChartManager.renderChartPipeline();
            };

            BotonClinicoContenedor.appendChild(BotonClinico);
        }

        BotonClinicoContenedor.appendChild(gridTarjetas);
        console.log("UroMx Módulo 5: Tarjetas inyectadas con éxito desde el DOM original.");
    },


    // 4. CONTROL DE TU PANEL FLOANTE REAL #modal-paciente
    // 4. CONTROL TOTAL DEL PANEL EDUCATIVO ENCIMA DE LA GRÁFICA (#modal-paciente)
    openPatientEducationalPanel: function(nombre, unidad, explicacionMedica, explicacionPaciente, rangos) {
        
		const modal = document.getElementById('modal-paciente');
        const canvas = document.getElementById('GraficoMiccionCanvas');
        if (!modal || !canvas) return;
    
        if (modal.checkVisibility() && modal.querySelector('h4').textContent === `${nombre} [${unidad}]`) {
        	modal.style.display = 'none';
        	return;
        }

        // Capturar las dimensiones y coordenadas físicas reales de tu gráfica en la pantalla
        const limitesGrafica = canvas.getBoundingClientRect();

        // Guardamos las explicaciones en los datos del modal para que el switch las recuerde al cambiar
        modal.dataset.expMedica = explicacionMedica || 'Sin descripción médica.';
        modal.dataset.expPaciente = explicacionPaciente || explicacionMedica || 'Sin descripción para paciente.';

        // POSICIONAMIENTO GEOMÉTRICO ESTRICTO: 30% de la altura de la gráfica, encima de ella [STEM]
        modal.style.display = 'block';
        modal.style.position = 'absolute';
        modal.style.left = `0px`;
    	modal.style.top = `0px`;
        modal.style.width = `${limitesGrafica.width}px`;
        modal.style.height = 'auto'; // 35% de la altura de tu canvas
        //modal.style.top = `${limitesGrafica.top + window.scrollY + (limitesGrafica.height * 0.65)}px`; // Colocado en la base superior
        modal.style.backgroundColor = '#ffffff';
        modal.style.boxShadow = '0 -4px 10px rgba(0,0,0,0.15)';
        modal.style.padding = '10px';
        modal.style.boxSizing = 'border-box';
        modal.style.zIndex = '99999';
        modal.style.overflowY = 'auto';

        // Estructura con tu botón deslizable (Switch) integrado
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:4px; margin-bottom:6px;">
                <h4 style="margin:0; font-size:14px; font-weight:bold; color:#000;">${nombre} [${unidad}]</h4>
                <div style="display:flex; align-items:center; gap:8px;">
                    <!-- BOTÓN DESLIZABLE (SWITCH DE VISTA) -->
                    <span style="font-size:11px; font-weight:bold; color:#555;">PACIENTE</span>
                    <label style="position:relative; display:inline-block; width:34px; height:20px; margin:0;">
                        <input type="checkbox" id="switch-vista-educativa" ${UroMxApp.state.switchVistaPaciente ? 'checked' : ''} style="opacity:0; width:0; height:0;">
                        <span style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#ccc; transition:.3s; border-radius:20px;"></span>
                    </label>
                    <span style="font-size:11px; font-weight:bold; color:#555;">MÉDICO</span>
                    <button onclick="document.getElementById('modal-paciente').style.display='none'" style="background:none; border:none; font-size:16px; cursor:pointer; margin-left:10px; padding:0; color:#888;">✕</button>
                </div>
            </div>
            <div id="cuerpo-explicacion-dinamica" style="font-size:12px; line-height:1.3; color:#333;"></div>
			<div style="font-size:12px; margin-top:8px; margin-bottom:2px; color:#000; padding-left:107px; text-indent:-104px; line-height:1.3;">
    <strong>Rangos Normales:</strong> <span style="color:#28a745; font-weight:bold;">${rangos || 'Clínico estándar'}</span>
</div>
        `;

        // Estilizar físicamente el círculo deslizable del switch
        const slider = modal.querySelector('label span');
        const inputCheckbox = modal.querySelector('#switch-vista-educativa');
        
        // Inyectar el CSS dinámico del switch para que se vea hermoso
        const styleToggle = () => {
            slider.style.backgroundColor = inputCheckbox.checked ? '#28a745' : '#28a745';
            slider.innerHTML = `<span style="position:absolute; content:''; height:14px; width:14px; left:3px; bottom:3px; background-color:white; transition:.3s; border-radius:50%; transform:${inputCheckbox.checked ? 'translateX(14px)' : 'translateX(0)'}"></span>`;
            
            // Alternancia de textos reales de tu base de datos
            const cuerpoExp = modal.querySelector('#cuerpo-explicacion-dinamica');
            cuerpoExp.innerHTML = inputCheckbox.checked ? modal.dataset.expPaciente : modal.dataset.expMedica;
        };

        // Escuchar el cambio del switch para guardarlo en el estado global y recordar la vista
        inputCheckbox.onchange = (e) => {
            UroMxApp.state.switchVistaPaciente = e.target.checked;
            styleToggle();
        };

        styleToggle(); // Ejecución inicial de nacimiento
    },


    evaluateMothersTitleLogic: function(madresON) {
        if (madresON.length === 1) {
            const mId = madresON[0];
            const promData = UroMxApp.state.cachedAverages.porDia[mId.toString()];
            const totalMicciones = promData ? promData.totalMicciones : 0;
            const primerHijo = UroMxApp.state.domFiltrado.find(item => Math.floor(Number(item.idDia)) === mId);
            return `Promedio de ${totalMicciones} micciones del ${primerHijo?.fecha?.substring(0, 10) || ''}.`;
        }

        let comboMicciones = 0;
        madresON.forEach(mId => {
            const promData = UroMxApp.state.cachedAverages.porDia[mId.toString()];
            if (promData) comboMicciones += promData.totalMicciones;
        });
        return `Promedio de ${comboMicciones} micciones en ${madresON.length} días seleccionados`;
    },

    evaluateChildrenTitleLogic: function(hijosON) {
        if (hijosON.length === 1) {
            const hijoActivo = UroMxApp.state.domFiltrado.find(item => item.idMix === hijosON[0]);
            return `Micción del ${hijoActivo?.fecha || ''}`;
        }

        const registrosHijos = UroMxApp.state.domFiltrado.filter(item => hijosON.includes(item.idMix));
        const diasDiferentes = new Set();
        registrosHijos.forEach(item => diasDiferentes.add(Math.floor(Number(item.idDia))));

        if (diasDiferentes.size === 1) {
            const primerHijo = registrosHijos[0];
            return `Promedio de ${hijosON.length} micciones del ${primerHijo?.fecha?.substring(0, 5) || ''}`;
        } else {
            return `Promedio de ${hijosON.length} micciones en ${diasDiferentes.size} diferentes días`;
        }
    }
};


// DISPARADOR INICIAL DEL NAVEGADOR
document.addEventListener('DOMContentLoaded', () => { 
    UroMxApp.init(); 
});

window.abrirDrawerFiltros = function(e) {   
    if (e) e.preventDefault();
    const drawerReal = document.getElementById('uro-drawer');
    const canvas = document.getElementById('GraficoMiccionCanvas');

    if (!drawerReal || !canvas || UroMxApp.state.modoDiagnosticoActivo) return;

    if (drawerReal.parentNode !== document.body) {
        document.body.appendChild(drawerReal);
    }

    if (drawerReal.style.display === 'block') {
        drawerReal.style.display = 'none';
        drawerReal.style.visibility = 'hidden';
    } else {
        const limitesGrafica = canvas.getBoundingClientRect();

        drawerReal.style.display = 'block';
        drawerReal.style.visibility = 'visible';
        drawerReal.style.opacity = '1';
        
        drawerReal.style.position = 'absolute';
        drawerReal.style.left = `${limitesGrafica.left + window.scrollX}px`; 
        drawerReal.style.top = `${limitesGrafica.top + window.scrollY}px`;   
        drawerReal.style.width = `${limitesGrafica.width * 0.45}px`; 
        drawerReal.style.minWidth = '280px'; 
        drawerReal.style.maxHeight = `${limitesGrafica.height * 1.5}px`;
        drawerReal.style.overflowY = 'auto'; 
        drawerReal.style.backgroundColor = '#ffffff'; 
        drawerReal.style.boxShadow = '0 12px 36px rgba(0,0,0,0.2)'; 
        drawerReal.style.borderRadius = '8px';
        drawerReal.style.padding = '14px 10px';
        drawerReal.style.boxSizing = 'border-box';
        drawerReal.style.zIndex = '9999999'; 
        drawerReal.style.transform = 'none'; 

        // --- MOTOR ARRASTRABLE 100% FLUIDO EN EJE X Y EJE Y (MÓDULO 5) ---
        const barraTitulo = drawerReal.querySelector('#uro-drawer-handle');
        if (barraTitulo) {
            barraTitulo.style.cursor = 'move';
            
            barraTitulo.onmousedown = (ev) => {
                ev.preventDefault();
                
                // Medimos dónde está parada la tarjeta físicamente en la pantalla
                const cajaReal = drawerReal.getBoundingClientRect();
                const desfasamientoX = ev.clientX - cajaReal.left;
                const desfasamientoY = ev.clientY - cajaReal.top;
                
                document.onmousemove = (movEv) => {
                    movEv.preventDefault();
                    // Colocamos el panel exactamente donde se mueva el puntero sin residuos mecánicos [STEM]
                    drawerReal.style.left = `${movEv.clientX - desfasamientoX + window.scrollX}px`;
                    drawerReal.style.top = `${movEv.clientY - desfasamientoY + window.scrollY}px`;
                };
                
                document.onmouseup = () => {
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };
        }


        // Cierre de la tacha "✕"
        const btnCerrar = drawerReal.querySelector('#btn-cerrar-drawer');
        if (btnCerrar) {
            btnCerrar.onclick = (ev) => {
                ev.preventDefault();
                drawerReal.style.display = 'none';
                drawerReal.style.visibility = 'hidden';
            };
        }

        if (UroMxApp && UroMxApp.FilterManager) {
            UroMxApp.FilterManager.bindHTMLElements();
            
            // --- DETECTOR DE ENFOQUE (CONECTA TUS CAMPOS AL REGISTRO DE ORIENTACIÓN) ---
            const fManager = UroMxApp.FilterManager;
            const camposDesde = [fManager.txtDesde, fManager.inputDesde, fManager.drawer.querySelector('#txt-hora-desde')];
            const camposHasta = [fManager.txtHasta, fManager.inputHasta, fManager.drawer.querySelector('#txt-hora-hasta')];

            camposDesde.forEach(el => { if (el) el.onfocus = () => fManager.updateQuickButtonsOrientation('DESDE'); });
            camposHasta.forEach(el => { if (el) el.onfocus = () => fManager.updateQuickButtonsOrientation('HASTA'); });
        }
    }
};

window.AnalisisClinico = function(event) {
    if (event) event.preventDefault();
    if (UroMxApp.ChartManager) {
        // REGLA TOGGLE: Si ya está activo el modo, funciona como escape; si no, entra [STEM]
        if (UroMxApp.state.modoDiagnosticoActivo) {
            if (typeof UroMxApp.ChartManager.ModoDiagnosticoSalida === 'function') {
                UroMxApp.ChartManager.ModoDiagnosticoSalida();
            }
        } else {
            if (typeof UroMxApp.ChartManager.ModoDiagnosticoEntrada === 'function') {
                UroMxApp.ChartManager.ModoDiagnosticoEntrada();
            }
        }
    }
};
