// Version 06/06/2026 hijos pintados de rojo, todos absolutamente todos.
let datosGlobales = {};          
let seriesSeleccionadas = [];    
let coloresAsignados = {};       
let chartInstance = null;        
let modoCalculosActivo = false;  
let estadoBotonSeleccion = 0; 
let categoriaActiva = 'todos'; 
let calculoHistoricoActivoId = null;    // Guarda el ID de la micción del histórico en pantalla
let calculoHistoricoActivoClave = null; // Guarda la clave métrica (Qmax, LinPUR, etc.) activa
let cicloDilatacionSeleccionadoActivo = null;


// Persistencia del perfil de lectura solicitado: 'coloquial' o 'medica'
let perfilExplicacionActivo = 'coloquial'; 

const PALETA_MADRES_MX = ['#162B35', '#78350F', '#BA1F1F', '#F27D4B', '#008736', '#0066FF', '#7C3AED'];
const PALETA_MADRES_AD = ['#00BCFF', '#32A584', '#EBD400', '#34C300', '#000087', '#87005A', '#686868'];

const PALETA_COLORES = ['#3498db', '#e67e22', '#9b59b6', '#2ecc71', '#1abc9c', '#34495e', '#f1c40f'];

//const PALETA_ON = [
 /*   '#162B4A', // 0. Negro adaptado a gris oscuro institucional para alta legibilidad web
    '#78350F', // 1. Café
    '#BA1F1F', // 2. Rojo
    '#F27D4B', // 3. Naranja
    '#EBD400', // 4. Amarillo
    '#1D4CB2', // 8. Azul
    '#7C3AED'  // 9. Violeta*/

const PALETA_RESISTENCIAS_ELECTRONICA = [


    '#162B35', // 0. Negro
    '#78350F', // 1. Café
    '#BA1F1F', // 2. Rojo
    '#F27D4B', // 3. Naranja
    '#EBD400', // 4. Amarillo
	'#34C300', // 5. Verde limón
	'#008736', // 6. Verde obscuro
    '#32A584', // 7. Aqua
	'#00BCFF', // 8. Cielo
    '#0066FF', // 9. Azul
	'#000087', // 10. Azul rey
    '#7C3AED', // 11. Violeta
	'#87005A', // 12. Guinda
	'#686868'  // 13. Gris
];

const FONDOS_PASTEL_RESISTENCIAS = [
    '#f1f5f9', // Negro tenue
    '#fef3c7', // Café tenue
    '#fee2e2', // Rojo tenue
    '#ffedd5', // Naranja tenue
    '#fef9c3', // Amarillo tenue
    '#dbeafe', // Azul tenue
    '#f3e8ff',  // Violeta tenue

    '#162B35', // 0. Negro
    '#78350F', // 1. Café
    '#BA1F1F', // 2. Rojo
    '#F27D4B', // 3. Naranja
    '#EBD400', // 4. Amarillo
	'#34C300', // 5. Verde limón
	'#008736', // 6. Verde obscuro
    '#32A584', // 7. Aqua
	'#00BCFF', // 8. Cielo
    '#0066FF', // 9. Azul
	'#000087', // 10. Azul rey
    '#7C3AED', // 11. Violeta
	'#87005A', // 12. Guinda
	'#686868'  // 13. Gris
];


async function cargarDatosUro() {
    try {
        const respuesta = await fetch('caudal_parser.php', { cache: 'no-store' });
        if (!respuesta.ok) throw new Error(`Error en servidor PHP: ${respuesta.status}`);
        datosGlobales = await respuesta.json();
        
        if (datosGlobales.error) {
            alert(datosGlobales.error);
            return;
        }
        
        // 1. Asignamos los colores base a los datos en memoria
        asignarColoresFijos();
        
        // 2. Conectamos la botonera del Drawer para que existan los inputs en el DOM
        if (typeof conectarBotoneraDrawer === 'function') {
            conectarBotoneraDrawer();
        }
        
        // 3. Inyectamos los rangos predeterminados del historial en las variables y calendarios
        if (typeof inicializarRangoDefaultDrawer === 'function') {
            inicializarRangoDefaultDrawer();
        }
        
         // 4. Simulamos el clic en "Historial" para rellenar los rangos visuales
        const btnHistorialDefault = document.querySelector('.btn-tiempo-rapido[data-dias="365"]');
        if (btnHistorialDefault) {
            btnHistorialDefault.click();
        }
        
        // 5. Renderizamos la lista de micciones. Esto disparará la gráfica automática inicial
        renderizarListaMicciones();
        
        // =========================================================================
        // CORRECCIÓN DE ARRANQUE: FORZAR SELECCIÓN SÓLIDA DE LA PRIMERA MADRE
        // =========================================================================
        const primerMadreFisica = document.querySelector('.lista-micciones-contenido .maestro-dia');
        if (primerMadreFisica) {
            // REGLA DE ORO: Vaciamos el arreglo masivo intruso generado por ejecutarFiltradoDatosUro
            // Esto obliga a que los hijos NÁZCAN DESELECCIONADOS (Apagados)
            seriesSeleccionadas = [];

            // Le forzamos la clase activa para que nazca seleccionada
            primerMadreFisica.classList.add('active');
            
            const colorBordePrimerMadre = primerMadreFisica.style.borderLeftColor || '#162B35';
            primerMadreFisica.style.backgroundColor = colorBordePrimerMadre;
            primerMadreFisica.style.color = '#ffffff';

            const textoFechaMadre = primerMadreFisica.textContent.trim();
            primerMadreFisica.setAttribute('data-graficar-promedio-fecha', textoFechaMadre);

            // Desplegamos físicamente su acordeón de hijos
            const subListaPrimerMadre = primerMadreFisica.nextElementSibling;
            if (subListaPrimerMadre) {
                subListaPrimerMadre.style.display = 'block';
                
                // Los hijos de esta primera madre se registran en las series para que la gráfica los dibuje presentes
                subListaPrimerMadre.querySelectorAll('.hijo-hora').forEach(hNode => {
                    hNode.classList.remove('active'); // Nacen deseleccionados en la lista
                    const idH = hNode.getAttribute('data-id');
                    
                    // Los metemos al arreglo de control para que Chart.js los pinte presentes en pastel (0.75)
                    if (!seriesSeleccionadas.includes(idH)) {
                        seriesSeleccionadas.push(idH);
                    }

                    const cromaticaH = obtenerConfiguracionCromatica('HIJO', idH);
                    hNode.style.backgroundColor = cromaticaH.pastel;
                    hNode.style.color = '#000000'; 
                });
            }
        }

        if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
        if (typeof alimentarPanelFlotanteEventos === 'function' && primerMadreFisica) {
            const textoFechaMadre = primerMadreFisica.textContent.trim();
            alimentarPanelFlotanteEventos('.hijo-hora', textoFechaMadre, 'sidebar');
        }
        
    } catch (error) {
        console.error("Error inicializando el ecosistema urodinámico:", error);
    }
}




function asignarColoresFijos() {
    let index = 0;
    Object.keys(datosGlobales).forEach(id => {
        coloresAsignados[id] = PALETA_COLORES[index % PALETA_COLORES.length];
        index++;
    });
}

// FUNCIÓN CENTRAL DE CÁLCULO CROMÁTICO ÁUREO
function obtenerConfiguracionCromatica(tipo, idOIndice) {
    // CORRECCIÓN DE EXTRACCIÓN: Eliminamos las letras "AD_" para quedarnos únicamente con el número limpio (ej. "AD_15" -> 15)
    const idLimpio = typeof idOIndice === 'string' ? idOIndice.replace('AD_', '') : idOIndice;
    const valor = parseInt(idLimpio, 10) || 0;

    // A) COLORES ESTÁTICOS REGULADOS PARA LAS CABECERAS MADRES
    if (tipo === 'MADRE_MX') {
        const idx = valor % PALETA_MADRES_MX.length;
        return { fondo: '#7f8c8d', borde: PALETA_MADRES_MX[idx], texto: '#ffffff' };
    }
    if (tipo === 'MADRE_AD') {
        const idx = valor % PALETA_MADRES_AD.length;
        return { fondo: '#7f8c8d', borde: PALETA_MADRES_AD[idx], texto: '#ffffff' };
    }

    // B) COLORES MATEMÁTICOS INMUTABLES PARA LOS HIJOS (ESPECTRO ÁUREO 137.5°)
    // El idOIndice aquí es la clave id del registro (ej. "AD_15")
    const miccion = datosGlobales[idOIndice];
    const zPantalla = (miccion && typeof miccion.indiceSecuencialPantalla !== 'undefined')
                      ? miccion.indiceSecuencialPantalla 
                      : 0;

    const tono = (zPantalla * 137.5) % 360;
    
    // Forzamos los porcentajes reales de diseño: 85% para sólido vivo, 35% y 90% para pastel médico limpio
    const fondoSeleccionado = `hsl(${tono}, 85%, 45%)`;
    const fondoDeseleccionado = `hsl(${tono}, 35%, 90%)`;

    let textoSeleccionado = '#ffffff';
    if (tono > 45 && tono < 95) textoSeleccionado = '#000000'; // Texto negro en amarillos/verdes

    return {
        solido: fondoSeleccionado,
        pastel: fondoDeseleccionado,
        txtSolido: textoSeleccionado,
        txtPastel: '#000000' // Siempre texto negro nítido sobre el fondo pastel
    };
}

// =========================================================================
// MOTOR CLÍNICO UNIFICADO: FILTRADO Y CÁLCULO DE PROMEDIOS FLEXIBLES
// =========================================================================
function procesarMetricasYPromediosUro(criterios = {}) {
    // 1. Obtener todas las micciones de la base de datos global
    let miccionesFiltradas = Object.values(datosGlobales);

    // 2. APLICACIÓN DE FILTROS DINÁMICOS Y FLEXIBLES
    // Filtro A: Por Selección Explícita en el arreglo global
    if (criterios.soloSeleccionadas === true) {
        miccionesFiltradas = miccionesFiltradas.filter(item => seriesSeleccionadas.includes(item.id));
    }

    // Filtro B: Por un Día específico (Formato de tu objeto: "AAAA-MM-DD")
    if (criterios.fechaDia) {
        miccionesFiltradas = miccionesFiltradas.filter(item => item.fecha && item.fecha.startsWith(criterios.fechaDia));
    }

    // Filtro C: Por Ciclo de Sonda de Autodilatación (AD / AU)
    if (criterios.cicloSonda) {
        // Buscamos si la micción pertenece al grupo del ciclo mapeado en tu MX_Por_Ciclo
        if (typeof MX_Por_Ciclo !== 'undefined' && MX_Por_Ciclo[criterios.cicloSonda]) {
            const idsDelCiclo = MX_Por_Ciclo[criterios.cicloSonda].map(m => m.id);
            miccionesFiltradas = miccionesFiltradas.filter(item => idsDelCiclo.includes(item.id));
        }
    }

    // Filtro D: Criterios Clínicos Combinados Avanzados (Ej: Volumen mayor a X ml)
    if (typeof criterios.volumenMinimo === 'number') {
        miccionesFiltradas = miccionesFiltradas.filter(item => item.volumen_total > criterios.volumenMinimo);
    }

    // 3. CÁLCULO MATEMÁTICO DE LOS PROMEDIOS CLÍNICOS
    const conteo = miccionesFiltradas.length;
    let sumaVolumen = 0;
    let sumaQMax = 0;

    miccionesFiltradas.forEach(item => {
        sumaVolumen += (item.volumen_total || 0);
        
        // Calculamos el Qmax real de esta micción buscando el punto más alto de su flujo
        if (item.flujo_mls && item.flujo_mls.length > 0) {
            const qMaxIndividual = Math.max(...item.flujo_mls);
            sumaQMax += qMaxIndividual;
        }
    });

    // 4. ESTRUCTURACIÓN DEL RETORNO CLÍNICO
    // Devolvemos tanto el listado de registros que pasaron la prueba como sus métricas promediadas
    return {
        registrosAfectados: miccionesFiltradas,
        totalRegistros: conteo,
        promedioVolumen: conteo > 0 ? Math.round(sumaVolumen / conteo) : 0,
        promedioQMax: conteo > 0 ? parseFloat((sumaQMax / conteo).toFixed(1)) : 0
    };
}

function renderizarListaMicciones() {
    const contenedor = document.getElementById('lista-micciones');
    if (!contenedor || typeof datosGlobales === 'undefined' || !datosGlobales) return;

    const btnDilataciones = document.getElementById('btn-filtro-dilataciones');
    const esModoDilataciones = btnDilataciones ? btnDilataciones.classList.contains('active') : false;

    contenedor.innerHTML = '';
    const keys = Object.keys(datosGlobales);

    if (!esModoDilataciones) {
    //MODO MICCIONES HASTA LÍNEA 293
        let MX_Por_Dia = {};
        keys.forEach(id => {
            const estudio = datosGlobales[id];
            if (!estudio || !estudio.fecha) return;
            
            // ELcandado que discrimina y oculta las micciones fuera de rango
            if (estudio.ocultoPorFiltro === true) return;

            const [f] = estudio.fecha.split(' ');
            const fLimpia = f.replace(/-/g, '/');
            
            if (!MX_Por_Dia[fLimpia]) MX_Por_Dia[fLimpia] = [];
            MX_Por_Dia[fLimpia].push({ id: id, datos: estudio });
        });

        let numeroMiccionGlobal = 0;
        Object.keys(MX_Por_Dia).forEach((fechaDia, idxDia) => {
            const grupoMX = MX_Por_Dia[fechaDia];
            
            // 1. CORREGIDO: Llamamos a la función de dos argumentos de forma correcta
            const cromaticaMadre = obtenerConfiguracionCromatica('MADRE_MX', idxDia);

            const botonMaestro = document.createElement('button');
            botonMaestro.className = 'item-miccion maestro-dia';
            botonMaestro.style.backgroundColor = '#7f8c8d'; 
            botonMaestro.style.color = '#ffffff';
            // 2. CORREGIDO: Cambia .fondoSeleccionado a .borde (El color estático brillante HSL)
            botonMaestro.style.borderLeft = `5px solid ${cromaticaMadre.borde}`;
            botonMaestro.style.whiteSpace = 'nowrap';
            botonMaestro.style.overflow = 'hidden';
            botonMaestro.style.textOverflow = 'ellipsis';
            botonMaestro.innerHTML = `<span style="font-weight:bold;">${fechaDia}</span>`;

            const divSubLista = document.createElement('div');
            divSubLista.className = 'sublista-acordeon-hijas';
            divSubLista.style.display = 'none';
            divSubLista.style.width = '100%';

            grupoMX.forEach(item => {
                const bHijo = document.createElement('button');
                bHijo.className = 'item-miccion hijo-hora';

                // 3. CORREGIDO: El hijo lee su color áureo inmutable usando el ID del registro
                const cromaticaHijoIndividual = obtenerConfiguracionCromatica('HIJO', item.id);
                datosGlobales[item.id].numeroSecuencialArchivo = numeroMiccionGlobal;

                // 4. CORREGIDO: Sincronizamos tus atributos dataset usando los nuevos nombres estrictos de la fórmula
                bHijo.setAttribute('data-fondo-solido', cromaticaHijoIndividual.solido);
                bHijo.setAttribute('data-texto-solido', cromaticaHijoIndividual.txtSolido);
                bHijo.setAttribute('data-fondo-pastel', cromaticaHijoIndividual.pastel);
                bHijo.setAttribute('data-texto-pastel', cromaticaHijoIndividual.txtPastel);
                bHijo.setAttribute('data-borde-madre', cromaticaMadre.borde);

                // Mantenemos tus asignaciones de control inalteradas
                item.colorGraficaLinea = cromaticaHijoIndividual.solido;
                datosGlobales[item.id].colorGraficaLinea = cromaticaHijoIndividual.solido;

                // 5. EVALUACIÓN DEL ESTADO INICIAL (Consonancia total con los datasets)
                if (seriesSeleccionadas.includes(item.id)) {
                    bHijo.classList.add('active');
                    bHijo.style.backgroundColor = cromaticaHijoIndividual.solido; 
                    bHijo.style.color = cromaticaHijoIndividual.txtSolido;
                } else {
                    bHijo.style.backgroundColor = cromaticaHijoIndividual.pastel; 
                    bHijo.style.color = cromaticaHijoIndividual.txtPastel;
                }

                // 6. REGLA DE ORO ACTUALIZADA: El borde izquierdo del hijo hereda sólidamente el color de la madre
                bHijo.style.borderLeft = `4px solid ${cromaticaMadre.borde}`;
                bHijo.style.paddingLeft = '15px';
                bHijo.style.width = '100%';
                bHijo.style.whiteSpace = 'nowrap';
                bHijo.setAttribute('data-id', item.id); 
                
                const [, h] = item.datos.fecha.split(' ');
                bHijo.innerHTML = `<span style="font-size:0.68rem;">${h.substring(0,5)}</span>`;

                bHijo.onclick = function(e) {   //CLICK SENCILLO HIJOS MX
                    e.stopPropagation();
                    if (e.type === 'touchstart') {
                        e.preventDefault();
                    }                
                    if (typeof reiniciarBotonSecuencial === 'function') reiniciarBotonSecuencial();
                    if (typeof cerrarVentanaPaciente === 'function') cerrarVentanaPaciente();
                    if (modoCalculosActivo && typeof regresarGraficaOriginal === 'function') regresarGraficaOriginal();

                    const index = seriesSeleccionadas.indexOf(item.id);
                    if (index === -1) {
                        seriesSeleccionadas.push(item.id);
                        bHijo.classList.add('active');
                        bHijo.style.backgroundColor = bHijo.getAttribute('data-fondo-solido'); 
                        bHijo.style.color = bHijo.getAttribute('data-texto-solido');
                    } else {
                        // Al deseleccionar, el botón lee de su memoria interna y recupera su estado pastel/negro de forma limpia
                        seriesSeleccionadas.splice(index, 1);
                        bHijo.classList.remove('active');
                        bHijo.style.backgroundColor = bHijo.getAttribute('data-fondo-pastel'); 
                        bHijo.style.color = bHijo.getAttribute('data-texto-pastel');
                    }

                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                    if (typeof mostrarTarjetasCalculos === 'function') {
                        document.getElementById('titulo-calculos').textContent = `MÉTRICAS URODINÁMICAS — ${item.datos.fecha}`;
                        mostrarTarjetasCalculos(item.id);
                        actualizarContadoresPestanas(item.id);
                    }
                };

                bHijo.ondblclick = function(e) {   //CLICK DOBLE HIJOS MX
                    e.stopPropagation();
                    e.preventDefault();
                    
                    seriesSeleccionadas = [item.id];

                    document.querySelectorAll('.sublista-acordeon-hijas .item-miccion').forEach(bh => {
                        if (bh !== bHijo) {   //@es necesario?
                            bh.classList.remove('active');
                            bh.style.backgroundColor = bh.getAttribute('data-fondo-pastel');
                            bh.style.color = bh.getAttribute('data-texto-pastel');
                        }
                    });
                                        
                    bHijo.classList.add('active');
                    bHijo.style.backgroundColor = bHijo.getAttribute('data-fondo-solido'); 
                    bHijo.style.color = bHijo.getAttribute('data-texto-solido');
                    
                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                };

                divSubLista.appendChild(bHijo);
                
                // INCREMENTO CRUCIAL DEL CONTADOR ABSOLUTO
                numeroMiccionGlobal++;
            }); // Aquí cierra el grupoMX.forEach

            // === SUSTITUCIÓN UNIFICADA EN BOTONMAESTRO.ONCLICK (NIVEL 1 Y NIVEL 2) ===
            botonMaestro.onclick = function(e) {
                e.stopPropagation();
                
                // Traemos el color real del bloque usando el método de dos argumentos de forma correcta
                const cromaticaFijaMadre = obtenerConfiguracionCromatica('MADRE_MX', idxDia);

                // =========================================================================
                // NIVEL 1: CLIC SIMPLE (Toggle Promedio Grueso Sólido + Remoción de Hijos)
                // =========================================================================
                if (e.detail === 1) {  //I-MX-1Click
                    if (typeof reiniciarBotonSecuencial === 'function') reiniciarBotonSecuencial();
                    if (typeof cerrarVentanaPaciente === 'function') cerrarVentanaPaciente();
                    if (modoCalculosActivo && typeof regresarGraficaOriginal === 'function') regresarGraficaOriginal();

                    botonMaestro.classList.toggle('active');
                    const estaActivoAhora = botonMaestro.classList.contains('active');
                    
                    if (estaActivoAhora) {
                        // SOLUClÓN: Absorbe de forma rígida el mismo color que tiene su borde izquierdo
                        botonMaestro.style.backgroundColor = cromaticaFijaMadre.borde;
                        botonMaestro.style.color = '#ffffff';
                        botonMaestro.setAttribute('data-graficar-promedio-fecha', fechaDia);
                    } else {
                        // Se apaga: Regresa a su gris de diseño pasivo uniforme
                        botonMaestro.style.backgroundColor = '#7f8c8d';
                        botonMaestro.style.color = '#ffffff';
                        botonMaestro.removeAttribute('data-graficar-promedio-fecha');
                        
                        // REQUERIMIENTO: Al deseleccionar la madre, removemos de forma rígida todos los hijos de este día de la gráfica
                        grupoMX.forEach(item => {
                            const idxHijoActivo = seriesSeleccionadas.indexOf(item.id);
                            if (idxHijoActivo !== -1) {
                                seriesSeleccionadas.splice(idxHijoActivo, 1);
                            }
                        });

                        // Limpiamos de forma inmediata las tarjetas correspondientes de este día en el drawer
                        if (typeof alimentarPanelFlotanteEventos === 'function') {
                            alimentarPanelFlotanteEventos('.hijo-hora', fechaDia, 'sidebar');
                        }
                    }

                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                }
                
                // =========================================================================
                // NIVEL 2: DOBLE CLIC CORREGIDO (Abre Acordeón + Hijos Pastel + CORRECCIÓN DRAWER)
                // =========================================================================
                if (e.detail === 2) {    //I-MX-2Click
                    e.preventDefault();
                    if (typeof reiniciarBotonSecuencial === 'function') reiniciarBotonSecuencial();
                    if (typeof cerrarVentanaPaciente === 'function') cerrarVentanaPaciente();
                    if (modoCalculosActivo && typeof regresarGraficaOriginal === 'function') regresarGraficaOriginal();

                    botonMaestro.classList.add('active');
                    botonMaestro.style.backgroundColor = cromaticaFijaMadre.borde;
                    botonMaestro.style.color = '#ffffff';
                    botonMaestro.setAttribute('data-graficar-promedio-fecha', fechaDia);

                    divSubLista.style.display = 'block';

                    // Forzamos la asignación de color pastel real con sus dos argumentos para corregir el gris
                    divSubLista.querySelectorAll('.hijo-hora').forEach(hijoNode => {
                        hijoNode.classList.remove('active');
                        const idHijo = hijoNode.getAttribute('data-id');
                        
                        // Llamamos la función con sus 2 argumentos correctos para pintar el pastel áureo
                        const cromaticaHijoReal = obtenerConfiguracionCromatica('HIJO', idHijo);
                        hijoNode.style.backgroundColor = cromaticaHijoReal.pastel;
                        hijoNode.style.color = cromaticaHijoReal.txtPastel; // Fuerza texto negro nítido

                        if (!seriesSeleccionadas.includes(idHijo)) {
                            seriesSeleccionadas.push(idHijo);
                        }
                    });

                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                    
                    if (typeof alimentarPanelFlotanteEventos === 'function') {
                        alimentarPanelFlotanteEventos('.hijo-hora', fechaDia, 'sidebar');
                    }
                }
                
                // =========================================================================
                // NIVEL 3: TRIPLE CLIC (Deselección Resto + Inicialización Rígida)
                // =========================================================================
                if (e.detail === 3) {  //I-MX-3Click
                    e.preventDefault();
                    if (typeof reiniciarBotonSecuencial === 'function') reiniciarBotonSecuencial();
                    if (typeof cerrarVentanaPaciente === 'function') cerrarVentanaPaciente();
                    if (modoCalculosActivo && typeof regresarGraficaOriginal === 'function') regresarGraficaOriginal();

                    seriesSeleccionadas = [];

                    // Apagamos y contraemos rígidamente todas las demás madres de la pantalla
                    document.querySelectorAll('.maestro-dia').forEach(otraMadre => {
                        if (otraMadre !== botonMaestro) {
                            otraMadre.classList.remove('active');
                            otraMadre.style.backgroundColor = '#7f8c8d';
                            otraMadre.style.color = '#ffffff';
                            otraMadre.removeAttribute('data-graficar-promedio-fecha');
                            
                            const otraSublista = otraMadre.nextElementSibling;
                            if (otraSublista && otraSublista.classList.contains('sublista-acordeon-hijas')) {
                                otraSublista.style.display = 'none';
                            }
                        }
                    });

                    botonMaestro.classList.add('active');
                    botonMaestro.style.backgroundColor = cromaticaFijaMadre.borde;
                    botonMaestro.style.color = '#ffffff';
                    botonMaestro.setAttribute('data-graficar-promedio-fecha', fechaDia);

                    divSubLista.style.display = 'block';

                    // Corregimos la llamada de dos argumentos para los hijos en el nivel 3
                    divSubLista.querySelectorAll('.hijo-hora').forEach(hijoNode => {
                        hijoNode.classList.remove('active');
                        const idHijo = hijoNode.getAttribute('data-id');
                        
                        const cromaticaHijoReal = obtenerConfiguracionCromatica('HIJO', idHijo);
                        hijoNode.style.backgroundColor = cromaticaHijoReal.pastel;
                        hijoNode.style.color = cromaticaHijoReal.txtPastel;

                        if (!seriesSeleccionadas.includes(idHijo)) {
                            seriesSeleccionadas.push(idHijo);
                        }
                    });

                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                    
                    if (typeof alimentarPanelFlotanteEventos === 'function') {
                        alimentarPanelFlotanteEventos('.hijo-hora', fechaDia, 'sidebar');
                    }
                }

                // =========================================================================
                // NIVEL 4: CUARTO CLIC (Alerta Reglamentaria Pendiente)
                // =========================================================================
                if (e.detail >= 4) {
                    e.preventDefault();
                    alert("I-MX-4");
                }
            };      

            contenedor.appendChild(botonMaestro);
            contenedor.appendChild(divSubLista);
        });


    } else {
    // MODO AUTODILATACIÓN HASTA LÍNEA 506
        let MX_Por_Ciclo = {};
    	keys.forEach(id => {
            const estudio = datosGlobales[id];
            if (!estudio || !estudio.fecha) return;
            
            // ELcandado que discrimina y oculta las micciones fuera de rango en AD
            if (estudio.ocultoPorFiltro === true) return;

            const nodoExistente = document.getElementById(id);
            if (nodoExistente && nodoExistente.style.display === 'none') return;
            
            const cicloIdx = estudio.dilatacion_ciclo ? parseInt(estudio.dilatacion_ciclo, 10) : 0;
            if (!MX_Por_Ciclo[cicloIdx]) MX_Por_Ciclo[cicloIdx] = [];
            MX_Por_Ciclo[cicloIdx].push({ id: id, datos: estudio });
        });

        Object.keys(MX_Por_Ciclo).sort((a, b) => b - a).forEach(cicloKey => {
            const cIdx = parseInt(cicloKey, 10);
            if (cIdx === 0) return;

            const grupoCiclo = MX_Por_Ciclo[cicloKey];
            
            // NUEVA IMPLEMENTACIÓN: Calculamos la cromática del bloque AD usando cIdx
            // Restamos 1 para alinearlo con base 0 si es necesario
            const cromaticaCiclo = obtenerConfiguracionCromatica(cIdx - 1);

            const micApertura = grupoCiclo.find(item => parseInt(item.datos.es_apertura, 10) === 1) || grupoCiclo[grupoCiclo.length - 1];
            const calibreFr = micApertura.datos.sonda_fr ? micApertura.datos.sonda_fr : 0;
            const fechaApertura = micApertura.datos.fecha.substring(0, 5);

            const botonMaestro = document.createElement('button');
            botonMaestro.className = 'item-miccion maestro-dilatacion';
            botonMaestro.style.backgroundColor = '#7f8c8d';
            botonMaestro.style.color = '#ffffff';
            // Modificado: El borde izquierdo ahora toma el color sólido áureo de este ciclo de sonda
            botonMaestro.style.borderLeft = `5px solid ${cromaticaCiclo.fondoSeleccionado}`;
            botonMaestro.style.whiteSpace = 'nowrap';
            botonMaestro.style.overflow = 'hidden';
            botonMaestro.style.textOverflow = 'ellipsis';
            botonMaestro.innerHTML = `<span style="font-weight:bold;">${fechaApertura} (${calibreFr})</span>`;

            const divSubLista = document.createElement('div');
            divSubLista.className = 'sublista-acordeon-hijas';
            divSubLista.style.display = 'none';
            divSubLista.style.width = '100%';

            // Para asegurar la coincidencia de color por micción individual, 
            // declaramos un contador z local para este bucle o usamos el id del item
            let zAD = 0;
			
            grupoCiclo.forEach(item => {
                const bHijo = document.createElement('button');
                bHijo.className = 'item-miccion hijo-estudio';

                // 1. EXTRAER SECUENCIA REAL: Traemos el número exacto que le dio el archivo original
                // Si por alguna razón no se ha mapeado, usamos un respaldo basado en su ID numérico
                const zReal = (datosGlobales[item.id] && typeof datosGlobales[item.id].numeroSecuencialArchivo !== 'undefined')
                              ? datosGlobales[item.id].numeroSecuencialArchivo 
                              : (parseInt(item.id, 10) || 0);

                // 2. GENERAR CROMÁTICA UNIFORME (Mismo color en MX, AD y Gráfica)
                const cromaticaHijoIndividual = obtenerConfiguracionCromatica('HIJO', item.id);
                datosGlobales[item.id].numeroSecuencialArchivo = numeroMiccionGlobal;

                // 4. Sincronizamos tus atributos dataset usando los nuevos nombres estrictos de la fórmula
                bHijo.setAttribute('data-fondo-solido', cromaticaHijoIndividual.solido);
                bHijo.setAttribute('data-texto-solido', cromaticaHijoIndividual.txtSolido);
                bHijo.setAttribute('data-fondo-pastel', cromaticaHijoIndividual.pastel);
                bHijo.setAttribute('data-texto-pastel', cromaticaHijoIndividual.txtPastel);
                bHijo.setAttribute('data-borde-madre', cromaticaMadre.borde);

                item.colorGraficaLinea = cromaticaHijoIndividual.solido;
                datosGlobales[item.id].colorGraficaLinea = cromaticaHijoIndividual.solido;

                // 5. EVALUACIÓN DEL ESTADO INICIAL (Forzamos texto negro #000000 para el estado pasivo pastel)
                if (seriesSeleccionadas.includes(item.id)) {
                    bHijo.classList.add('active');
                    bHijo.style.backgroundColor = cromaticaHijoIndividual.solido; 
                    bHijo.style.color = cromaticaHijoIndividual.txtSolido;
                } else {
                    bHijo.style.backgroundColor = cromaticaHijoIndividual.pastel; 
                    bHijo.style.color = '#000000'; // Destruye la herencia de texto blanco en el panel izquierdo
                }


                // 4. Borde sólido que hereda el color brillante de su ciclo de sonda
                bHijo.style.borderLeft = `4px solid ${bHijo.getAttribute('data-borde-madre')}`;
                bHijo.style.paddingLeft = '15px';
                bHijo.style.width = '100%';
                bHijo.style.whiteSpace = 'nowrap';

                const [fStr, hStr] = item.datos.fecha.split(' ');
                const diaUnica = fStr.substring(8, 10); 
                const horaUnica = hStr.substring(0, 2); 

                bHijo.setAttribute('data-id', item.id);
                bHijo.innerHTML = `<span style="font-size:0.65rem;">${diaUnica} ${horaUnica}</span>`;


                // === 5. EVENTO CLICK SENCILLO (MODO AD) ===
                bHijo.onclick = function(e) {
                    e.stopPropagation();
                    if (e.type === 'touchstart') {
                        e.preventDefault();
                    }                
                    if (typeof reiniciarBotonSecuencial === 'function') reiniciarBotonSecuencial();
                    if (typeof cerrarVentanaPaciente === 'function') cerrarVentanaPaciente();
                    if (modoCalculosActivo && typeof regresarGraficaOriginal === 'function') regresarGraficaOriginal();

                    const index = seriesSeleccionadas.indexOf(item.id);
                    // Obtenemos la cromática real y fija para esta micción usando su ID nativo
                    const colorFijo = obtenerConfiguracionCromatica(parseInt(item.id, 10) || 0);

                    if (index === -1) {
                        seriesSeleccionadas.push(item.id);
                        bHijo.classList.add('active');
                        // Fuerza el color sólido brillante y su texto correcto sin usar el dataset deslavado
                        bHijo.style.backgroundColor = colorFijo.fondoSeleccionado; 
                        bHijo.style.color = colorFijo.textoSeleccionado;
                    } else {
                        seriesSeleccionadas.splice(index, 1);
                        bHijo.classList.remove('active');
                        // Fuerza el color pastel original y texto negro
                        bHijo.style.backgroundColor = colorFijo.fondoDeseleccionado; 
                        bHijo.style.color = '#000000';
                    }        

                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                    if (typeof mostrarTarjetasCalculos === 'function') {
                        document.getElementById('titulo-calculos').textContent = `MÉTRICAS URODINÁMICAS — ${item.datos.fecha}`;
                        mostrarTarjetasCalculos(item.id);
                        actualizarContadoresPestanas(item.id);
                    }
                };

                // === 6. EVENTO DOBLE CLICK (MODO AD) ===
                bHijo.ondblclick = function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    seriesSeleccionadas = [item.id];
                    const colorFijoActivo = obtenerConfiguracionCromatica(parseInt(item.id, 10) || 0);

                    // Al limpiar a los hermanos, recalculamos su pastel original para que no se deslaven
                    divSubLista.querySelectorAll('.hijo-estudio').forEach(bh => {
                        if (bh !== bHijo) {
                            bh.classList.remove('active');
                            // Suponiendo que el ID de cada hermano está accesible o guardado en el nodo
                            const idHermano = parseInt(bh.id.replace('hijo-', ''), 10) || 0;
                            const colorHermano = obtenerConfiguracionCromatica(idHermano);
                            bh.style.backgroundColor = colorHermano.fondoDeseleccionado;
                            bh.style.color = '#000000';
                        }
                    });

                    // Encendemos el botón actual con total nitidez
                    bHijo.classList.add('active');
                    bHijo.style.backgroundColor = colorFijoActivo.fondoSeleccionado; 
                    bHijo.style.color = colorFijoActivo.textoSeleccionado;                     
                    
                    // CORREGIDO: Ejecutamos la gráfica al final para que el refresco asíncrono de Chart.js 
                    // no interrumpa ni congele el primer doble click
                    setTimeout(() => {
                        if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                    }, 10);
                };

                divSubLista.appendChild(bHijo);
            }); // Aquí cierra el grupoCiclo.forEach de AUTODILATACIONES
        
            botonMaestro.onclick = function(e) {
                e.stopPropagation();

                // === NIVEL 1: CLIC SIMPLE AUTODILATACIÓN LEFT PANEL (Toggle Selección habitual) ===
                if (e.detail === 1) {
                    if (typeof reiniciarBotonSecuencial === 'function') reiniciarBotonSecuencial();
                    if (typeof cerrarVentanaPaciente === 'function') cerrarVentanaPaciente();
                    if (modoCalculosActivo && typeof regresarGraficaOriginal === 'function') regresarGraficaOriginal();

                    botonMaestro.classList.toggle('active');
                    
                    if (botonMaestro.classList.contains('active')) {
                        //botonMaestro.style.backgroundColor = '#7f8c8d';
                        //botonMaestro.style.color = '#ffffff';
                    	botonMaestro.style.backgroundColor = cromaticaCiclo.fondoSeleccionado;
                    	botonMaestro.style.color = cromaticaCiclo.textoSeleccionado;
                    
                        
                        grupoCiclo.forEach(item => {
                            if (!seriesSeleccionadas.includes(item.id)) seriesSeleccionadas.push(item.id);
                        });
                        divSubLista.querySelectorAll('.hijo-estudio').forEach(bh => {
                            bh.classList.add('active');
                            bh.style.backgroundColor = bh.getAttribute('data-fondo-solido');
                            bh.style.color = bh.getAttribute('data-texto-solido');
                        });
                    } else {
                    	botonMaestro.style.backgroundColor = '#7f8c8d';
                        botonMaestro.style.color = '#ffffff';
                        
                        grupoCiclo.forEach(item => {
                            const idx = seriesSeleccionadas.indexOf(item.id);
                            if (idx !== -1) seriesSeleccionadas.splice(idx, 1);
                        });

                        divSubLista.querySelectorAll('.hijo-estudio').forEach(bh => {
                            bh.classList.remove('active');
                            bh.style.backgroundColor = bh.getAttribute('data-fondo-pastel');
                            bh.style.color = bh.getAttribute('data-texto-pastel');
                        });
                    }

                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                    if (grupoCiclo.length > 0 && typeof mostrarTarjetasCalculos === 'function') {
                        const ult = grupoCiclo[grupoCiclo.length - 1];
                        document.getElementById('titulo-calculos').textContent = `MÉTRICAS URODINÁMICAS — ${ult.datos.fecha}`;
                        mostrarTarjetasCalculos(ult.id);
                        actualizarContadoresPestanas(ult.id);
                    }

                    // === SINCRONIZACIÓN MULTI-CICLO AUTOMÁTICA AD ===
                    // Refresca o retira los estudios del panel flotante en sincronía con tu clic de datos reales
                    if (typeof alimentarPanelFlotanteEventos === 'function') {
                    	alimentarPanelFlotanteEventos('.hijo-estudio', cicloKey, 'sidebar');
                    }
                };

                // === NIVEL 2: DOBLE CLIC LEFT PANEL - AUTODILATACIÓN (Despliegue / Repliegue del Acordeón) === 
                if (e.detail === 2) {   
                    e.preventDefault();           
                    // 1. SELECCIÓN COERCITIVA: Si el ciclo maestro estaba apagado, lo encendemos de forma oficial junto con sus hijos
                    if (!botonMaestro.classList.contains('active')) {
                        if (typeof reiniciarBotonSecuencial === 'function') reiniciarBotonSecuencial();
                        if (typeof cerrarVentanaPaciente === 'function') cerrarVentanaPaciente();
                        if (modoCalculosActivo && typeof regresarGraficaOriginal === 'function') regresarGraficaOriginal();

                        botonMaestro.classList.add('active');
//                        botonMaestro.style.backgroundColor = '#7f8c8d';
//                        botonMaestro.style.color = '#ffffff';
                    	botonMaestro.style.backgroundColor = cromaticaCiclo.fondoSeleccionado;
                    	botonMaestro.style.color = cromaticaCiclo.textoSeleccionado;
                    
                        
                        // Sincronizamos de forma segura todos los IDs de este ciclo en el arreglo de gráficas
                        grupoCiclo.forEach(item => {
                            if (!seriesSeleccionadas.includes(item.id)) seriesSeleccionadas.push(item.id);
                        });
                    }

                    // 2. Activamos el display de la sublista en la sombra del DOM para la lectura de la subrutina
                    divSubLista.style.display = 'block';
                    
                    // 3. Renderizamos la gráfica colectiva unificada del calibre seleccionado
                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();

                    // 4. ALIMENTACIÓN AUTOMÁTICA DEL PANEL FLOTANTE AD:
                    if (typeof alimentarPanelFlotanteEventos === 'function') {
                    	alimentarPanelFlotanteEventos('.hijo-estudio', cicloKey, 'sidebar');
                    }
                };

                // === NIVEL 3: TRIPLE CLIC LEFTPANEL - AUTODILATACIÓN (Deselección resto - Despliegue / Repliegue del Acordeón) === 
                if (e.detail === 3) {
                    e.preventDefault();
                    // 1. Vaciamos la selección global y adoptamos únicamente los elementos de este ciclo de autodilatación
                    seriesSeleccionadas = grupoCiclo.map(item => item.id);

                    // 2. Apagamos visualmente TODAS las demás madres e hijos del contenedor, y CONTRAEMOS sus acordeones
                    contenedor.querySelectorAll('.maestro-dia, .maestro-dilatacion').forEach(nodo => {
                        nodo.classList.remove('active');
                        nodo.style.backgroundColor = '#7f8c8d'; // Estado pasivo maestro
                        nodo.style.color = '#ffffff';
                    });

                    contenedor.querySelectorAll('.sublista-acordeon-hijas').forEach(subLista => {
                        subLista.style.display = 'none'; // Contrae todos los acordeones del contenedor
                    });

                    contenedor.querySelectorAll('.item-miccion:not(.maestro-dia):not(.maestro-dilatacion), .hijo-hora, .hijo-estudio').forEach(hijo => {
                        hijo.classList.remove('active');
                        hijo.style.backgroundColor = '#f1f5f9'; // Apagado clínico visual limpio //duda
                        hijo.style.color = '#000000';
                    });

                    // 3. Encendemos exclusivamente los componentes de este grupo activo y EXPANDIMOS su acordeón en la sombra
                    botonMaestro.classList.add('active');
                    //botonMaestro.style.backgroundColor = '#7f8c8d';
                    //botonMaestro.style.color = '#ffffff';
                    botonMaestro.style.backgroundColor = cromaticaCiclo.fondoSeleccionado;
                    botonMaestro.style.color = cromaticaCiclo.textoSeleccionado;
                
                    
                    divSubLista.style.display = 'block'; // Asegura despliegue exclusivo de la autodilatación actual
                    divSubLista.querySelectorAll('.item-miccion, .hijo-estudio').forEach(bh => {
                        bh.classList.add('active');
                        bh.style.backgroundColor = bh.getAttribute('data-fondo-solido');
                        bh.style.color = bh.getAttribute('data-texto-solido');
                    });

                    // 4. Renderizamos la gráfica con el bloque unificado
                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();

                    // 5. BLINDAJE ASÍNCRONO INMUNE A HUÉRFANOS:
                    // Le damos 20 milisegundos al navegador para que asiente la limpieza del DOM antes de escanear los calibres
                    setTimeout(() => {
                        if (typeof alimentarPanelFlotanteEventos === 'function') {
                        	alimentarPanelFlotanteEventos('.hijo-estudio', cicloKey, 'sidebar');
                        }
                    }, 20);
                }
            };

            contenedor.appendChild(botonMaestro);
            contenedor.appendChild(divSubLista);
        });
    }
    const primerBotonLista = contenedor.querySelector('.item-miccion');

    if (primerBotonLista && seriesSeleccionadas.length === 0) {
        primerBotonLista.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 3 // Fuerza a la grilla a interpretar que es un triple clic real
        }));
    }

}

function procesarBotonSecuencial() {
    const todosLosIds = Object.keys(datosGlobales);
    const boton = document.getElementById('btn-modo-seleccion');
    if (estadoBotonSeleccion === 0) {
        let nuevaSeleccion = [];
        todosLosIds.forEach(id => {
            if (!seriesSeleccionadas.includes(id)) nuevaSeleccion.push(id);
        });
        seriesSeleccionadas = nuevaSeleccion;
        boton.textContent = "Deseleccionar Todos";
        estadoBotonSeleccion = 1;
    } else {
        seriesSeleccionadas = [];
        boton.textContent = "Invertir Selección";
        estadoBotonSeleccion = 0;
    }

    renderizarListaMicciones();
    if (!modoCalculosActivo) renderizarGraficaEstandar();
}

function reiniciarBotonSecuencial() {
    estadoBotonSeleccion = 0;
    const boton = document.getElementById('btn-modo-seleccion');
    if (boton) boton.textContent = "Invertir Selección";
}

function ejecutarClickSimple(id) {
    const miccion = datosGlobales[id];
    if (!miccion) return;
    
    document.getElementById('titulo-calculos').textContent = `MÉTRICAS URODINÁMICAS — ${miccion.fecha}`;
    renderizarGraficaIndividual(id);
    mostrarTarjetasCalculos(id);
    actualizarContadoresPestanas(id);
}

function filtrarCategoria(categoria, itemPestana) {
    categoriaActiva = categoria;
    document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
    itemPestana.classList.add('active');

    const titulo = document.getElementById('titulo-calculos').textContent;
    const partes = titulo.split(' — ');
    if (partes.length > 1) {
        const fechaActiva = partes[1].trim();
        const idActivo = Object.keys(datosGlobales).find(key => datosGlobales[key].fecha === fechaActiva);
        if (idActivo) mostrarTarjetasCalculos(idActivo);
    }
}

function actualizarContadoresPestanas(idSerie) {
    const miccion = datosGlobales[idSerie];
    if (!miccion || !miccion.calculos) return;
    let contadores = { todos: 0, flujos: 0, tiempos: 0, volumenes: 0, fluidos: 0 };
    Object.keys(miccion.calculos).forEach(clave => {
        const calc = miccion.calculos[clave];
        contadores.todos++;
        if (contadores[calc.grupo] !== undefined) {
            contadores[calc.grupo]++;
        }
    });

    document.getElementById('cnt-todos').textContent = `${contadores.todos}`;
    document.getElementById('cnt-flujos').textContent = `${contadores.flujos}`;
    document.getElementById('cnt-tiempos').textContent = `${contadores.tiempos}`;
    document.getElementById('cnt-volumenes').textContent = `${contadores.volumenes}`;
    document.getElementById('cnt-fluidos').textContent = `${contadores.fluidos}`;
}

function mostrarTarjetasCalculos(idSerie) {
    const contenedorCalculos = document.getElementById('contenedor-calculos');
    contenedorCalculos.innerHTML = '';
    
    const miccion = datosGlobales[idSerie];
    if (!miccion || !miccion.calculos) return;

    Object.keys(miccion.calculos).forEach(clave => {
        const calc = miccion.calculos[clave];
        if (categoriaActiva !== 'todos' && calc.grupo !== categoriaActiva) return;

        const card = document.createElement('div');
        card.className = `card-calculo badge-${calc.semaforo} cat-bg-${calc.grupo}`;
        card.setAttribute('data-clave', clave);
        card.setAttribute('data-idserie', idSerie);
        
        card.innerHTML = `
            <button class="btn-info-tarjeta">i</button>
            <div class="calc-nomenclatura">${calc.nomenclatura}</div>
            <div class="calc-nombre">${calc.nombre}</div>
            <div class="calc-valor">${calc.valor} <span class="calc-unidad">${calc.unidad}</span></div>
        `;

        // Click en cualquier área de la tarjeta: Trazar Historial Gráfico (Un solo click)
        card.addEventListener('click', (e) => {
            reiniciarBotonSecuencial();
            activarGraficaCalculos(idSerie, clave);
        });

        // Click exclusivo en el botón (i): Disparar interruptor inteligente de ventana informativa
        const btnInfo = card.querySelector('.btn-info-tarjeta');
        btnInfo.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que se dispare la graficación al tocar la (i)
            abrirVentanaPaciente(idSerie, clave);
        });

        contenedorCalculos.appendChild(card);
    });
}


/**
 * =========================================================================
 * MOTOR GRÁFICO URODINÁMICO ADAPTATIVO (Inciso B y D — Escalas Lineales Reales)
 * =========================================================================
 */
function renderizarGraficaIndividual(id) {    
    const miccion = datosGlobales[id];
    if (!miccion || !miccion.tiempo_seg) return;
    // Curva X-Y: Tiempo transcurrido en segundos vs Velocidad de flujo en mL/s
    const puntos = miccion.tiempo_seg.map((t, idx) => ({ x: t, y: miccion.flujo_mls[idx] }));
    const datasets = [{
        label: `${id}`,
        data: puntos,
        //borderColor: miccion.colorGraficaLinea || '#162B35', 
    	borderColor: '#FF00FF', //cromaticaCiclo.fondoSeleccionado,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4, // Línea suavizada de dinámica de fluidos ICS
        pointRadius: 0,
        showLine: true
    }];

    configurarYActualizarChart(datasets, 'Tiempo (segundos)', 'Velocidad de Flujo (mL/s)', 5, 2, false);
}

function renderizarGraficaEstandar() {
    modoCalculosActivo = false;
    const btnSalir = document.getElementById('btn-salir-modo');
    if (btnSalir) btnSalir.style.display = 'none';

    // Inicializamos el contenedor de conjuntos de datos para Chart.js
    const datasets = [];

        // =========================================================================
    // TRATO 1: GRAFICACIÓN FLEXIBLE DE HIJOS INDIVIDUALES (ESTADOS DINÁMICOS)
    // =========================================================================
    if (seriesSeleccionadas && seriesSeleccionadas.length > 0) {
        seriesSeleccionadas.forEach(id => {
            const miccion = datosGlobales[id];
            if (!miccion || !miccion.tiempo_seg) return;

            // Buscamos si el botón físico del hijo está encendido con .active en la pantalla
            const btnFisico = document.querySelector(`button[data-id="${id}"]`);
            const estaActivoEnLista = btnFisico ? btnFisico.classList.contains('active') : false;

            const cromaticaHijoReal = obtenerConfiguracionCromatica('HIJO', id);

            let grosorLinea = 1.5;
            let colorLinea = cromaticaHijoReal.solido;

            // REGLA: Si el botón físico no está explícitamente encendido (active),
            // la gráfica lo dibuja de forma obligatoria en su tono pastel delgado de 0.75
            if (!estaActivoEnLista) {
                grosorLinea = 0.75;
                colorLinea = cromaticaHijoReal.pastel; 
            }

            datasets.push({
                label: `Micción ${id}`,
                data: miccion.tiempo_seg.map((t, idx) => ({ x: t, y: miccion.flujo_mls[idx] })),
                borderColor: colorLinea,
                backgroundColor: 'transparent',
                borderWidth: grosorLinea,
                tension: 0.14,
                pointRadius: 0,
                showLine: true,
                order: 2
            });
        });
    }

    // =========================================================================
    // TRATO 2: GRAFICACIÓN DE PROMEDIOS DIARIOS DE TIEMPO EXTENDIDO (I-MX-1click)
    // =========================================================================
    const madresConPromedio = document.querySelectorAll('.maestro-dia[data-graficar-promedio-fecha]');
    
    madresConPromedio.forEach(madreNode => {
        const fechaFiltrar = madreNode.getAttribute('data-graficar-promedio-fecha');
        const resultadoMetricas = procesarMetricasYPromediosUro({ fechaDia: fechaFiltrar });
        
        if (resultadoMetricas.totalRegistros > 0) {
            const colorBordeMadre = window.getComputedStyle(madreNode).borderLeftColor || '#7f8c8d';
            
            // 1. REQUERIMIENTO CLÍNICO: Encontrando la micción más larga de todo el día (Cesta Máxima)
            let miccionMasLarga = resultadoMetricas.registrosAfectados[0];
            resultadoMetricas.registrosAfectados.forEach(m => {
                if (m.tiempo_seg && m.tiempo_seg.length > miccionMasLarga.tiempo_seg.length) {
                    miccionMasLarga = m;
                }
            });

            // 2. MATEMÁTICA DE PROMEDIOS CON RELLENO EN CERO PARA AUSENTES
            const datosPuntosPromedio = miccionMasLarga.tiempo_seg.map((t, idxSeg) => {
                let sumaFlujoEnSegundo = 0;
                let totalMiccionesDelDia = resultadoMetricas.totalRegistros;
                
                resultadoMetricas.registrosAfectados.forEach(m => {
                    if (m.flujo_mls && typeof m.flujo_mls[idxSeg] !== 'undefined') {
                        sumaFlujoEnSegundo += m.flujo_mls[idxSeg];
                    } else {
                        // Si la micción ya terminó (datos ausentes), sumamos cero de forma explícita
                        sumaFlujoEnSegundo += 0;
                    }
                });
                
                return {
                    x: t,
                    y: parseFloat((sumaFlujoEnSegundo / totalMiccionesDelDia).toFixed(2))
                };
            });

            const partesF = fechaFiltrar.split('-');
            const etiquetaFecha = partesF.length === 3 ? `${partesF[2]}/${partesF[1]}` : fechaFiltrar;

            datasets.push({
                label: `Promedio ${etiquetaFecha}`,
                data: datosPuntosPromedio,
                borderColor: colorBordeMadre,
                backgroundColor: 'transparent',
                borderWidth: 2, // Grosor 3 sólido unificado reglamentario promedio
                tension: 0.14,
                pointRadius: 0,
                showLine: true,
                order: 1
            });
        }
    });

    // =========================================================================
    // EVALUACIÓN DEL LIENZO: Si no hay curvas que pintar, destruimos la instancia
    // =========================================================================
    if (datasets.length === 0) {
        if (chartInstance) chartInstance.destroy();
        return;
    }

    // Actualizamos el Chart de forma nativa con los conjuntos de datos recopilados
    configurarYActualizarChart(datasets, 'Tiempo (segundos)', 'Velocidad de Flujo (mL/s)', 5, 2, false);
}


// Variable global para mapear de forma estricta e idéntica las fechas en el eje X sin desfase
let mapaFechasHistorico = [];

/**
 * =========================================================================
 * CORRECCIÓN CASO B DE DEFINITIVA: GRAFICACIÓN HISTÓRICA INMUNE A ZONAS HORARIAS
 * =========================================================================
 */
function activarGraficaCalculos(idSerie, claveCalculo) {
    modoCalculosActivo = true;
    calculoHistoricoActivoId = idSerie;
    calculoHistoricoActivoClave = claveCalculo;

    const calcMuestra = datosGlobales[idSerie].calculos[claveCalculo];
    const btnDilataciones = document.getElementById('btn-filtro-dilataciones');
    const esModoDilataciones = btnDilataciones ? btnDilataciones.classList.contains('active') : false;

    let todasLasMicciones = Object.keys(datosGlobales).reverse();

    if (esModoDilataciones) {
        todasLasMicciones = todasLasMicciones.filter(id => datosGlobales[id] && datosGlobales[id].ocultoPorFiltro !== true);
    } else {
        todasLasMicciones = todasLasMicciones.filter(id => {
            const estudio = datosGlobales[id];
            if (!estudio || !estudio.fecha) return false;
            if (estudio.ocultoPorFiltro === true) return false;
            return true;
        });
    }

    let mapaMinutosAperturaCiclos = {};
    if (esModoDilataciones) {
        Object.keys(datosGlobales).forEach(id => {
            const est = datosGlobales[id];
            if (est && parseInt(est.es_apertura, 10) === 1) {
                const [fP, hP] = est.fecha.split(' ');
                const sep = fP.includes('/') ? '/' : '-';
                const [d, m, y] = fP.split(sep);
                const [h, min] = hP.split(':');
                const anioFull = (y.length === 4) ? parseInt(y, 10) : 2000 + parseInt(y, 10);
                
                const minAbs = (anioFull * 525600) + (parseInt(m, 10) * 43800) + (parseInt(d, 10) * 1440) + (parseInt(h, 10) * 60) + parseInt(min, 10);
                mapaMinutosAperturaCiclos[parseInt(est.dilatacion_ciclo, 10)] = minAbs;
            }
        });
    }

    let puntosHistoricos = [];
    mapaFechasHistorico = [];

    todasLasMicciones.forEach((id, indiceX) => {
        const miccion = datosGlobales[id];
        if (miccion.calculos && miccion.calculos[claveCalculo]) {
            const valorNumerico = parseFloat(miccion.calculos[claveCalculo].valor.replace(/,/g, ''));
            
            mapaFechasHistorico[indiceX] = miccion.fecha;

            const [fechaPartes, horaPartes] = miccion.fecha.split(' ');
            const separador = fechaPartes.includes('/') ? '/' : '-';
            const [dia, mes, anio] = fechaPartes.split(separador);
            const [hora, minuto] = horaPartes.split(':');
            const anioCompleto = (anio.length === 4) ? parseInt(anio, 10) : 2000 + parseInt(anio, 10);
            
            let minutosAbsolutos = (anioCompleto * 525600) + 
                                     (parseInt(mes, 10) * 43800) + 
                                     (parseInt(dia, 10) * 1440) + 
                                     (parseInt(hora, 10) * 60) + 
                                     parseInt(minuto, 10);

            let diasTranscurridos = minutosAbsolutos;

            if (esModoDilataciones) {
                const cId = miccion.dilatacion_ciclo ? parseInt(miccion.dilatacion_ciclo, 10) : 0;
                const minApertura = mapaMinutosAperturaCiclos[cId];
                if (typeof minApertura !== 'undefined') {
                    diasTranscurridos = (minutosAbsolutos - minApertura) / 1440.0;
                }
            }

            puntosHistoricos.push({
                x: diasTranscurridos, 
                y: valorNumerico,
                metaFecha: miccion.fecha,
                cicloId: miccion.dilatacion_ciclo ? parseInt(miccion.dilatacion_ciclo, 10) : 0,
                idMiccionOriginal: id
            });
        }
    });

    puntosHistoricos.sort((a, b) => a.x - b.x);

    let datasets = [];

    if (esModoDilataciones) {
        // CORRECCIÓN: Leemos directamente el arreglo global seriesSeleccionadas para saber qué graficar
        let ciclosFiltrarUsuario = [];
        
        if (typeof seriesSeleccionadas !== 'undefined' && seriesSeleccionadas.length > 0) {
            seriesSeleccionadas.forEach(idMX => {
                if (datosGlobales[idMX] && datosGlobales[idMX].dilatacion_ciclo) {
                    const cNum = parseInt(datosGlobales[idMX].dilatacion_ciclo, 10);
                    if (!ciclosFiltrarUsuario.includes(cNum)) ciclosFiltrarUsuario.push(cNum);
                }
            });
        }

        let gruposPorCiclo = {};
        puntosHistoricos.forEach(pt => {
            if (!gruposPorCiclo[pt.cicloId]) gruposPorCiclo[pt.cicloId] = [];
            gruposPorCiclo[pt.cicloId].push(pt);
        });

        // Mapeo cronológico original ascendente de las llaves de ciclos para resguardar el slam masivo de origen
        Object.keys(gruposPorCiclo).forEach(cKey => {
            const cIdx = parseInt(cKey, 10);
            if (cIdx === 0) return;
            
            // Si el UX ya manipuló la selección, filtramos de forma rígida; si no, pinta todas juntas por default
            if (ciclosFiltrarUsuario.length > 0 && !ciclosFiltrarUsuario.includes(cIdx)) return;

            const colorIndex = (cIdx - 1) % PALETA_RESISTENCIAS_ELECTRONICA.length;
            const colorLineaResistencia = PALETA_RESISTENCIAS_ELECTRONICA[colorIndex];

            datasets.push({
                label: `Dilatación ${cIdx}`,
                data: gruposPorCiclo[cIdx],
                borderColor: obtenerConfiguracionCromatica(cIdx - 1).fondoSeleccionado,
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                tension: 0.4,
                pointRadius: 0, 
                pointHoverRadius: 4,
                fill: false,
                showLine: true
            });
        });
    } else {
        let colorSemaforoLinea = '#2ecc71'; 
        if (calcMuestra.semaforo === 'ambar') colorSemaforoLinea = '#f1c40f';
        if (calcMuestra.semaforo === 'rojo') colorSemaforoLinea = '#e74c3c';
alert("a2");
        datasets.push({
            label: `${calcMuestra.nombre}`,
            data: puntosHistoricos,
            borderColor: colorSemaforoLinea,
            backgroundColor: 'transparent',
            borderWidth: 1.0,
            tension: 0.1, 
            pointRadius: 0, 
            pointHoverRadius: 4,
            fill: false,
            showLine: true
        });
    }

    const tituloEjeX = esModoDilataciones ? 'Días desde la Autodilatación' : 'Tiempo';
    const tituloEjeY = `${calcMuestra.nombre} (${calcMuestra.unidad})`;
    
    configurarYActualizarChart(datasets, tituloEjeX, tituloEjeY, esModoDilataciones ? -0.1 : null, null, true);
}

function regresarGraficaOriginal() {
    modoCalculosActivo = false;
    renderizarGraficaEstandar();
}

if (typeof Chart !== 'undefined') {
    Chart.Tooltip.positioners.esquinaFija = function(items, eventPosition) {
        // 'this' hace referencia al objeto tooltip activo en memoria
        const anchoTooltip = this.width || 180; // Ancho estimado del recuadro negro
        const anchoGrafica = this.chart.width;  // Ancho total disponible en tu pantalla
        
        return {
            x: anchoGrafica, // Se pega a la derecha dejando un margen clínico de 15px
            y: 10                                // Se mantiene fijo arriba a 15px del ras
        };
    };
}

function configurarYActualizarChart(datasets, labelX, labelY, stepX, stepY, esModoHistorico = false) {
    // === OPERACIÓN DE CANCELACIÓN INMEDIATA EN SEGUNDO PLANO ===
    if (chartInstance) {
        chartInstance.destroy(); // Cancela y borra el dibujo anterior en cola inmediatamente
        chartInstance = null;    // Libera la memoria del hilo de renderizado
    }

    const canvas = document.getElementById('uroChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (typeof Chart === 'undefined') return;
    

    let configuracionEjeX = {
        type: 'linear',
        title: { display: true, text: labelX, font: { weight: 'bold', size: 12 } },
        grid: { color: 'rgba(148, 163, 184, 0.12)', borderColor: '#cbd5e1' }
    };

    // CONDICIÓN MAESTRA AD: Si es el eje de días relacionales, fuerza el despegue izquierdo y limpia las etiquetas
    if (labelX === 'Días desde la Autodilatación') {
        configuracionEjeX.min = -0.1; // Inyecta el pasillo en blanco izquierdo de 2 horas relativas solicitado
        configuracionEjeX.ticks = {
            stepSize: 1, // Fuerza a que la rejilla avance estrictamente de uno en un día entero
            callback: function(value) {
                const n = parseFloat(value);
                if (n === 0) return 'AD (0d)';
                if (n < 0) return ''; // Oculta números sucios en el pasillo de colchón
                return n % 1 === 0 ? `${n}d` : `${n.toFixed(1)}d`; // Imprime los números de días transcurridos planos
            },
            maxRotation: 45,
            minRotation: 15
        };
    } else if (esModoHistorico) {
        configuracionEjeX.ticks = {
            callback: function(value, index, values) {
                if (datasets && datasets[0] && datasets[0].data) {
                    const puntoCoincidente = datasets[0].data.find(p => p.x === value);
                    if (puntoCoincidente && puntoCoincidente.metaFecha) {
                        const [fPartes, hPartes] = puntoCoincidente.metaFecha.split(' ');
                        const sep = fPartes.includes('/') ? '/' : '-';
                        const [d, m] = fPartes.split(sep);
                        const [hh, mm] = hPartes.split(':');
                        return `${d}-${m} ${hh}:${mm}`;
                    }
                }
                return '';
            },
            maxRotation: 45,
            minRotation: 15
        };
    } else {
        if (stepX) configuracionEjeX.ticks = { stepSize: stepX };
    }

    let configuracionEjeY = {
        type: 'linear',
        title: { display: true, text: labelY, font: { weight: 'bold', size: 12 } },
        grid: { color: 'rgba(148, 163, 184, 0.12)', borderColor: '#cbd5e1' }
    };
    if (!esModoHistorico && stepY) configuracionEjeY.ticks = { stepSize: stepY };

    const mostrarLeyenda = false;


    chartInstance = new Chart(ctx, {
        type: 'line', 
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            resizeDelay: 0,
            layout: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
            interaction: { 
                mode: 'index', 
                intersect: false,
                events: ['click', 'touchstart']
            },
            scales: { x: configuracionEjeX, y: configuracionEjeY },
            plugins: {
                legend: { 
                    display: mostrarLeyenda, 
                    position: mostrarLeyenda ? 'right' : 'top', 
                    labels: { usePointStyle: false, boxWidth: 4, font: { size: 10, weight: 'normal' } } 
                },
                tooltip: {
                    enabled: true,
                    displayColors: true,
                    boxWidth: 6,
                    boxPadding: 3,
                    titleAlign: 'center',
                    titleFont: { family: 'monospace', weight: 'bold', size: 13 },
                    bodyFont: { family: 'monospace', weight: 'normal', size: 11 },
                    position: 'esquinaFija', 
                    animation: { duration: 0 },
                    callbacks: {
                        title: function(context) {
                            if (context.length === 0) return '';
                            const punto = context[0];
                            const tiempoValor = punto.parsed.x;
                            if (labelX === 'Días desde la Autodilatación') {
                                return punto.parsed.x === 0 ? 'AD (0d)' : `${punto.parsed.x.toFixed(2)}d`;
                            }
                            return `${Math.round(parseFloat(tiempoValor))}s`;
                        },
                        label: function(context) {
                            const datasetIndex = context.datasetIndex;
                            const indicePunto = context.dataIndex;
                            const idSerieActual = context.chart.data.datasets[datasetIndex].id_miccion;
                            
                            if (typeof datosGlobales !== 'undefined' && datosGlobales && idSerieActual && datosGlobales[idSerieActual]) {
                                const estudio = datosGlobales[idSerieActual];
                                if (estudio && estudio.fecha) {
                                    const [fechaCompleta, horaCompleta] = estudio.fecha.split(' ');
                                    const sep = fechaCompleta.includes('/') ? '/' : '-';
                                    const [d, m, y] = fechaCompleta.split(sep);
                                    const fCorta = `${d}/${m}/${y.substring(2)}`;
                                    const hCorta = horaCompleta.substring(0, 5);

                                    const flujoValor = context.raw;
                                    const flujoFormateado = parseFloat(flujoValor).toFixed(3);
                                    const tipoUnidad = labelY.includes('Volumen') ? 'mL' : 'mL/s';

                                    return `${fCorta} ${hCorta} — ${flujoFormateado}${tipoUnidad}`;
                                }
                            }
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(3)}`;
                        }
                    }
                },
                zoom: {
                    zoom: {
                        drag: { enabled: true, backgroundColor: 'rgba(52, 152, 219, 0.15)', borderWidth: 1, borderColor: '#3498db' },
                        pinch: { enabled: true },             
                        mode: 'x',
                        onZoomComplete: function({chart}) {
                            if (chart && chart.scales.y) {
                                chart.options.scales.y.min = chart.scales.y.min;
                                chart.options.scales.y.max = chart.scales.y.max;
                            }
                        }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',           
                        threshold: 5,        
                        modifierKey: null    
                    }
                }
            }
        }
    });

    canvas.oncontextmenu = function(e) {
        e.preventDefault();
        if (chartInstance) {
            if (chartInstance.options.scales.y) {
                delete chartInstance.options.scales.y.min;
                delete chartInstance.options.scales.y.max;
            }
            chartInstance.resetZoom();
        }
    };
}

/**
 * =========================================================================
 * INICIO ARQUITECTURA DETALLADA: INTERRUPTOR MAESTRO (TOGGLE) DE PANTALLA COMPLETA
 * =========================================================================
 */
(function inicializarPantallaCompletaUro() {
    const canvas = document.getElementById('uroChart');
    if (!canvas) return;

    let modoPantallaCompletaActivo = false;

    canvas.addEventListener('dblclick', function(e) {
        e.stopPropagation(); // Previene cualquier colisión sintáctica con el restablecimiento de la manija
        
        const contenedorPadreApp = document.querySelector('.app-container');
        const barraLateralSidebar = document.querySelector('.sidebar');
        const manijaSplitter = document.getElementById('uro-splitter');
        const panelMétricasCalculos = document.querySelector('.calculos-section');
        const contenedorContenidoPrincipal = document.querySelector('.main-content');

        if (!modoPantallaCompletaActivo) {
            // MODO EXPANSIÓN 100%: Ocultar elementos periféricos del ecosistema urológico
            if (barraLateralSidebar) barraLateralSidebar.style.display = 'none';
            if (manijaSplitter) manijaSplitter.style.display = 'none';
            if (panelMétricasCalculos) panelMétricasCalculos.style.display = 'none';
            
            // Reconfigurar las dimensiones de la grilla principal para absorber todo el espacio libre
            if (contenedorPadreApp) contenedorPadreApp.style.gridTemplateColumns = '1fr';
            if (contenedorContenidoPrincipal) contenedorContenidoPrincipal.style.gridTemplateRows = '100%';
            
            modoPantallaCompletaActivo = true;
        } else {
            // MODO RESTAURACIÓN: Devolver la grilla a la vista compartida de análisis clínico habitual
            if (barraLateralSidebar) barraLateralSidebar.style.display = 'flex';
            if (manijaSplitter) manijaSplitter.style.display = 'block';
            if (panelMétricasCalculos) panelMétricasCalculos.style.display = 'flex';
            
            if (contenedorPadreApp) contenedorPadreApp.style.gridTemplateColumns = '340px 1fr';
            if (contenedorContenidoPrincipal) contenedorContenidoPrincipal.style.gridTemplateRows = '60% 3px calc(40% - 5px)';
            
            modoPantallaCompletaActivo = false;
        }

        // Forzar la actualización elástica estructural e inmediata del lienzo gráfico sin rezagos
        if (chartInstance) chartInstance.resize();
    });
})();


function abrirVentanaPaciente(idSerie, claveCalculo) {
    const modal = document.getElementById('modal-paciente');
    if (!modal) return;
    
    const yaEstaVisible = (modal.style.display === 'block');
    const mismaSerie = (modal.getAttribute('data-idserie') === idSerie);
    const mismaClave = (modal.getAttribute('data-clave') === claveCalculo);

    // Si el usuario vuelve a presionar el mismo botón (i) de la tarjeta activa, se cierra
    if (yaEstaVisible && mismaSerie && mismaClave) {
        cerrarVentanaPaciente();
        return;
    }

    // Guardar los identificadores en el contenedor para la persistencia
    modal.setAttribute('data-idserie', idSerie);
    modal.setAttribute('data-clave', claveCalculo);

    // Renderizar el contenido base por primera vez
    actualizarContenidoPerfil(idSerie, claveCalculo);
}

function conmutarPerfilExplicacion(e) {
    e.stopPropagation(); // Detiene cualquier propagación elástica del click
    const modal = document.getElementById('modal-paciente');
    if (!modal) return;
    
    const idSerie = modal.getAttribute('data-idserie');
    const clave = modal.getAttribute('data-clave');

    if (!idSerie || !clave) return;

    // Cambiar y recordar la redacción para la próxima selección
    perfilExplicacionActivo = (perfilExplicacionActivo === 'coloquial') ? 'medica' : 'coloquial';
    
    // Invocación directa al renderizado interno sin pasar por la lógica de abrir/cerrar
    actualizarContenidoPerfil(idSerie, clave);
}

/**
 * Motor de Inyección de Redacción Médica / Coloquial Aislado
 */
function actualizarContenidoPerfil(idSerie, claveCalculo) {
    const modal = document.getElementById('modal-paciente');
    if (!modal) return;
    const calc = datosGlobales[idSerie].calculos[claveCalculo];
    
    let txtHtml = `
        <div class="modal-paciente-header">
            <div class="perfil-toggle-container">
                <span class="perfil-lbl ${perfilExplicacionActivo === 'coloquial' ? 'perfil-lbl-active' : ''}">Modo Paciente</span>
                <div class="perfil-switch-bg" onclick="conmutarPerfilExplicacion(event)">
                    <div class="perfil-switch-handle ${perfilExplicacionActivo === 'medica' ? 'handle-right' : ''}"></div>
                </div>
                <span class="perfil-lbl ${perfilExplicacionActivo === 'medica' ? 'perfil-lbl-active' : ''}">Especialista</span>
            </div>
        </div>
        <div class="modal-paciente-body">
            <h2 style="font-family:'Times New Roman',serif; margin-top:0;">${calc.nomenclatura} — ${calc.nombre}</h2>
    `;

    if (perfilExplicacionActivo === 'coloquial') {
        txtHtml += `
            <p class="desc-texto">${calc.explicacion_paciente}</p>
            <div class="rango-referencia-box">
                <strong>Valores de Referencia Generales:</strong><br>
                ${calc.rangos_normales}
            </div>
        `;
    } else {
        txtHtml += `
            <p class="desc-texto"><strong>Correlación Fisiopatológica:</strong> ${calc.explicacion}</p>
            <div class="rango-referencia-box" style="border-left-color:#2563eb;">
                <strong>Interpretación Médica y Signos de Alerta:</strong><br>
                ${calc.alertas_medicas}
            </div>
        `;
    }

    txtHtml += `</div>`;
    modal.innerHTML = txtHtml;
    modal.style.display = 'block'; // Asegura su permanencia en pantalla de forma rígida
}

function cerrarVentanaPaciente() {
    const modal = document.getElementById('modal-paciente');
    if (modal) modal.style.display = 'none';
}

function abrirModalLeyenda() {
    const modal = document.getElementById('modal-leyenda-cat');
    if (!modal) return;
    
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
    }    
}

function inicializarCierreEventos() {
    document.addEventListener('click', (e) => {
        const modalPaciente = document.getElementById('modal-paciente');
        if (modalPaciente && modalPaciente.style.display === 'block') {
            if (!modalPaciente.contains(e.target) && !e.target.closest('.card-calculo')) {
                cerrarVentanaPaciente();
            }
        }
    });
    const btnCerrarFlotante = document.getElementById('btn-cerrar-flotante');
    if (btnCerrarFlotante) {
        btnCerrarFlotante.onclick = function(e) {
            e.stopPropagation();
            document.getElementById('flotante-hijos-uro').style.display = 'none';
        };
    }
}

/**
 * =========================================================================
 * ARQUITECTURA HÍBRIDA UNIFICADA: INTERRUPTOR MAESTRO DE PANTALLA COMPLETA CON ALERTAS
 * =========================================================================
 */
let modoPantallaCompletaActivo = false;

function conmutarDimensionesPantallaCompleta() {
    const contenedorPadreApp = document.querySelector('.app-container');
    const barraLateralSidebar = document.querySelector('.sidebar');
    const manijaSplitter = document.getElementById('uro-splitter');
    const panelMetricasCalculos = document.querySelector('.calculos-section');
    const contenedorContenidoPrincipal = document.getElementById('main-content-split');

    // Destrucción preventiva de la caché para recuperar elasticidad de alto/ancho
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    if (!modoPantallaCompletaActivo) {
        if (barraLateralSidebar) barraLateralSidebar.style.display = 'none';
        if (manijaSplitter) manijaSplitter.style.display = 'none';
        if (panelMetricasCalculos) panelMetricasCalculos.style.display = 'none';
        
        if (contenedorPadreApp) contenedorPadreApp.style.gridTemplateColumns = '1fr';
        if (contenedorContenidoPrincipal) contenedorContenidoPrincipal.style.gridTemplateRows = '100%';
        modoPantallaCompletaActivo = true;
    } else {
        if (barraLateralSidebar) barraLateralSidebar.style.display = 'flex';
        if (manijaSplitter) manijaSplitter.style.display = 'block';
        if (panelMetricasCalculos) panelMetricasCalculos.style.display = 'flex';
        
        if (contenedorPadreApp) contenedorPadreApp.style.gridTemplateColumns = '140px 1fr';
        if (contenedorContenidoPrincipal) contenedorContenidoPrincipal.style.gridTemplateRows = '60% 3px calc(40% - 5px)';
        modoPantallaCompletaActivo = false;
    }

    // Micro-pausa asíncrona optimizada de 40ms para el acoplamiento de grilla CSS
    setTimeout(() => {
        forzarRedibujoGraficaActual();
    }, 40); 
}

/**
 * Función Auxiliar Centralizadora de Redibujo con Memoria de Estado
 */
function forzarRedibujoGraficaActual() {
    // CORRECCIÓN DE REDIBUJADO: Si estamos en modo cálculo, lee de forma rígida la persistencia global
    if (modoCalculosActivo && calculoHistoricoActivoId && calculoHistoricoActivoClave) {
        if (typeof activarGraficaCalculos === 'function') {
            activarGraficaCalculos(calculoHistoricoActivoId, calculoHistoricoActivoClave);
        }
    } else {
        // MODO ESTÁNDAR PERMANENTE: Al maximizar o redimensionar la ventana, la gráfica 
        // respeta de forma estricta la vista colectiva unificada del panel izquierdo (MX y AD)
        if (typeof renderizarGraficaEstandar === 'function') {
            renderizarGraficaEstandar();
        }
    }
}


// Inicializador elástico unificado acoplado al Canvas para doble evento (PC y Táctil)
(function inicializarEventosPantallaCompleta() {
    const canvas = document.getElementById('uroChart');
    if (!canvas) return;

    // PC: Escucha de doble click clásico del ratón
    canvas.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        conmutarDimensionesPantallaCompleta();
    });

    // MÓVIL: Sensor de Doble Toque Táctil Artificial (Double Tap) Blindado
    let ultimoToqueTiempo = 0;
    canvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            const tiempoActual = new Date().getTime();
            const diferenciaMilisegundos = tiempoActual - ultimoToqueTiempo;
            
            if (diferenciaMilisegundos < 300 && diferenciaMilisegundos > 40) {
                // SÓLO bloquea el navegador si es un doble toque real de pantalla completa
                e.preventDefault();  
                e.stopPropagation();  
                conmutarDimensionesPantallaCompleta();
            }
            ultimoToqueTiempo = tiempoActual;
        }
    }, { passive: true }); 

})();

/**
 * =========================================================================
 * MOTOR INTERACTIVO SPLITTER (Arrastre Elástico y Doble Clic de Restablecimiento)
 * =========================================================================
 */
(function inicializarSplitterUrodinamico() {
    const mainContent = document.getElementById('main-content-split');
    const splitter = document.getElementById('uro-splitter');
    
    if (!mainContent || !splitter) return;

    let estaArrastrando = false;

    splitter.addEventListener('mousedown', function(e) {
        e.preventDefault();
        estaArrastrando = true;
        splitter.classList.add('active');
        document.body.style.cursor = 'row-resize';
    });

    document.addEventListener('mousemove', function(e) {
        if (!estaArrastrando) return;

        const contLimites = mainContent.getBoundingClientRect();
        const alturaTotal = contLimites.height;
        const mouseYRelativo = e.clientY - contLimites.top;

        let porcentajeSuperior = (mouseYRelativo / alturaTotal) * 100;
        if (porcentajeSuperior < 25) porcentajeSuperior = 25;
        if (porcentajeSuperior > 75) porcentajeSuperior = 75;

        const porcentajeInferior = 99 - porcentajeSuperior;
        mainContent.style.gridTemplateRows = `${porcentajeSuperior}% 3px ${porcentajeInferior}%`;
    });

    document.addEventListener('mouseup', function() {
        if (estaArrastrando) {
            estaArrastrando = false;
            splitter.classList.remove('active');
            document.body.style.cursor = 'default';
        }
    });

    splitter.addEventListener('dblclick', function() {
        // Restablecimiento calibrado a la proporción de diseño de tu grilla
        mainContent.style.gridTemplateRows = "60% 3px calc(40% - 5px)";
    });
})();

document.addEventListener("DOMContentLoaded", cargarDatosUro);


document.addEventListener("DOMContentLoaded", () => {
    const d = document.getElementById('txt-fecha-desde');
    const h = document.getElementById('txt-fecha-hasta');
    
    if (d) {
        d.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                validarLimitesTeclado(d, true);
            }
        };
    }
    if (h) {
        h.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                validarLimitesTeclado(h, false);
            }
        };
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const labelsCalendario = document.querySelectorAll('.btn-icon-calendario-label');
    
    labelsCalendario.forEach(label => {
        label.addEventListener('click', function(e) {
            e.preventDefault(); 
            e.stopPropagation(); 
            
            const idInputDestino = label.getAttribute('for');
            const inputNativo = document.getElementById(idInputDestino);
            
            // === SINOPSIS DE CONTROL: DETECTAR INTERACCIÓN Y ASIGNAR SIGNOS DE INMEDIATO ===
            if (idInputDestino === 'native-date-desde') {
                ultimoInputModificado = 'desde';
            } else if (idInputDestino === 'native-date-hasta') {
                ultimoInputModificado = 'hasta';
            }
            
            // Forzamos el cambio visual de los botones (+ / -) apenas se abre el calendario
            if (typeof actualizarSignosBotonesTiempo === 'function') {
                actualizarSignosBotonesTiempo();
            }
            
            // Apertura oficial del selector de fechas del navegador
            if (inputNativo && typeof inputNativo.showPicker === 'function') {
                inputNativo.showPicker();
            }
        });
    });
});

window.addEventListener('resize', function() {
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    setTimeout(() => {
        forzarRedibujoGraficaActual();
    }, 50);
});

/**
 * =========================================================================
 * MOTOR INTERACTIVO CENTRAL DEL DRAWER DE FILTROS CLÍNICOS
 * =========================================================================
 */

// A) DISPARADOR PRINCIPAL: Control de apertura elástica inmune
function abrirDrawerFiltros(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const drawer = document.getElementById('uro-drawer');
    if (drawer) {
        const posGuardada = localStorage.getItem('uroDrawerPos');
        if (posGuardada) {
            const pos = JSON.parse(posGuardada);
            drawer.style.left = pos.left;
            drawer.style.top = pos.top;
        } else {
            // DETECCIÓN COERCITIVA: Si la pantalla es delgada (CV), se ajusta a 0px para no cargarse a la izquierda
            if (window.innerWidth <= 480) {
                drawer.style.left = '0px';
                drawer.style.top = '20px';
            } else {
                drawer.style.left = '10px';
                drawer.style.top = '10px';
            }
        }
        conectarBotoneraDrawer();
    }
}


// B) MOTOR DE INTERACCIÓN, AUTOMATISMOS CRONOLÓGICOS Y ARRASTRE
function conectarBotoneraDrawer() {
    const drawer = document.getElementById('uro-drawer');
    const headerHandle = document.getElementById('uro-drawer-handle');
    const btnCerrar = document.getElementById('btn-cerrar-drawer');
    const btnMicciones = document.getElementById('btn-filtro-micciones');
    const btnDilataciones = document.getElementById('btn-filtro-dilataciones');
    
    const inputDateDesde = document.getElementById('native-date-desde');
    const inputDateHasta = document.getElementById('native-date-hasta');
    const txtFechaDesde = document.getElementById('txt-fecha-desde');
    const txtFechaHasta = document.getElementById('txt-fecha-hasta');
    const txtHoraDesde = document.getElementById('txt-hora-desde');
    const txtHoraHasta = document.getElementById('txt-hora-hasta');
    
    const btnLimpiar = document.getElementById('btn-drawer-limpiar');
    const btnInvertir = document.getElementById('btn-drawer-invertir');
    const btnAplicar = document.getElementById('btn-drawer-aplicar');

    let ultimoInputModificado = 'hasta';
    txtFechaDesde.onfocus = function() { 
        ultimoInputModificado = 'desde'; 
        actualizarSignosBotonesTiempo(); 
    };
    
    txtFechaHasta.onfocus = function() { 
        ultimoInputModificado = 'hasta'; 
        actualizarSignosBotonesTiempo(); 
    };

    // Funciones de parseo cronológico inmunes a NaN
    function strADate(s) {
        const p = s.split(s.includes('/') ? '/' : '-');
        return new Date(2000 + parseInt(p[2],10), parseInt(p[1],10)-1, parseInt(p[0],10));
    }

    function dateAStr(d) {
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).substring(2)}`;
    }

    function syncDateInput(txt, inp) {
        if (txt.value.trim() !== "") {
            const [d, m, y] = txt.value.trim().split('/');
            inp.value = `20${y.padStart(2,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        }
    }

    // 1. INVOCACIÓN DE CALENDARIO NATIVO AL CLIC EXACTO
    if (inputDateDesde) {
        inputDateDesde.onchange = function() {
            if (inputDateDesde.value) {
                const [y, m, d] = inputDateDesde.value.split('-');
                txtFechaDesde.value = `${d}/${m}/${y.substring(2)}`;
                ultimoInputModificado = 'desde';
                validarEInvertirFechasDra();
            }
        };
    }

    if (inputDateHasta) {
        inputDateHasta.onchange = function() {
            if (inputDateHasta.value) {
                const [y, m, d] = inputDateHasta.value.split('-');
                txtFechaHasta.value = `${d}/${m}/${y.substring(2)}`;
                ultimoInputModificado = 'hasta';
                validarEInvertirFechasDra();
            }
        };
    }

    // 2. SISTEMA DRAG AND DROP CON MEMORIA DE FLOTACIÓN
    if (headerHandle && drawer) {
        let activeDrag = false, currentX, currentY, initialX, initialY;
        
        headerHandle.onmousedown = startDrag;
        headerHandle.ontouchstart = startDrag;

        function startDrag(e) {
            e.stopPropagation();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            initialX = clientX - drawer.offsetLeft;
            initialY = clientY - drawer.offsetTop;
            activeDrag = true;
            document.onmousemove = dragMove;
            document.ontouchmove = dragMove;
            document.onmouseup = endDrag;
            document.ontouchend = endDrag;
        }

        function dragMove(e) {
            if (!activeDrag) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            currentX = clientX - initialX;
            currentY = clientY - initialY;
            drawer.style.left = `${currentX}px`;
            drawer.style.top = `${currentY}px`;
        }

        function endDrag() {
            activeDrag = false;
            document.onmousemove = document.ontouchmove = null;
            document.onmouseup = document.ontouchend = null;
            localStorage.setItem('uroDrawerPos', JSON.stringify({left: drawer.style.left, top: drawer.style.top}));
        }
    }

    // 3. ACCIÓN: CERRAR (×)
    if (btnCerrar) {
        btnCerrar.onclick = function(e) {
            e.stopPropagation();
            drawer.style.left = '-500px';
        };
    }

    // 4. SECCIÓN MODOS (MICCIÓN / DILATACIÓN)
    if (btnMicciones && btnDilataciones) {
        const lblTituloSidebar = document.getElementById('lbl-sidebar-titulo');
        
        btnMicciones.onclick = function() {
            btnMicciones.classList.add('active');
            btnDilataciones.classList.remove('active');
            if (lblTituloSidebar) lblTituloSidebar.textContent = "MICCIÓN";
            seriesSeleccionadas = [];
            if (typeof renderizarListaMicciones === 'function') renderizarListaMicciones();
        };
        btnDilataciones.onclick = function() {
            btnDilataciones.classList.add('active');
            btnMicciones.classList.remove('active');
            if (lblTituloSidebar) lblTituloSidebar.textContent = "DILATACIÓN";
            seriesSeleccionadas = [];
            if (typeof renderizarListaMicciones === 'function') renderizarListaMicciones();
        };
    }




    // =========================================================================
    // 5. ACCIÓN ABIS: TIEMPOS RÁPIDOS E HISTORIAL CRONOLÓGICO
    // =========================================================================
    document.querySelectorAll('.btn-tiempo-rapido').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            document.querySelectorAll('.btn-tiempo-rapido').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const dias = parseInt(btn.getAttribute('data-dias'), 10);
            const keys = Object.keys(datosGlobales);
            if (keys.length === 0) return;

            // Función interna para parsear las fechas reales del archivo
            function deCadenaADateLocal(s) {
                const p = s.split(' ')[0].split(s.includes('/') ? '/' : '-');
                const aFull = (p[2].length === 4) ? parseInt(p[2], 10) : 2000 + parseInt(p[2], 10);
                return new Date(aFull, parseInt(p[1], 10) - 1, parseInt(p[0], 10));
            }

            let fechas = keys.map(k => deCadenaADateLocal(datosGlobales[k].fecha)).sort((a,b) => a - b);
            const dMin = fechas[0];
            const dMax = fechas[fechas.length - 1];

            const fMinStr = dateAStr(dMin);
            const fMaxStr = dateAStr(dMax);

            if (dias === 365) { // HISTORIAL COMPLETO
                txtFechaDesde.value = fMinStr;
                txtFechaHasta.value = fMaxStr;
                txtHoraDesde.value = "00:00";
                txtHoraHasta.value = "24:00";
                return;
            }

            if (dias === 0 && txtFechaDesde.value.trim() === txtFechaHasta.value.trim()) { // HOY COMPACTO
                txtFechaDesde.value = fMaxStr;
                txtFechaHasta.value = fMaxStr;
                return;
            }

            let dObj = txtFechaDesde.value ? strADate(txtFechaDesde.value) : new Date(dMax.getTime());
            let hObj = txtFechaHasta.value ? strADate(txtFechaHasta.value) : new Date(dMax.getTime());

            if (ultimoInputModificado === 'desde') {
                hObj = new Date(dObj.getTime());
                hObj.setDate(hObj.getDate() + dias);
            } else {
                dObj = new Date(hObj.getTime());
                dObj.setDate(dObj.getDate() - dias);
            }

            // VALIDACIÓN DE LÍMITES: Si el cálculo de días excede los rangos reales, se acopla al borde
            if (dObj < dMin) dObj = new Date(dMin.getTime());
            if (dObj > dMax) dObj = new Date(dMax.getTime());
            if (hObj < dMin) hObj = new Date(dMin.getTime());
            if (hObj > dMax) hObj = new Date(dMax.getTime());

            if (dObj > hObj) { const t = dObj; dObj = hObj; hObj = t; }
            
            txtFechaDesde.value = dateAStr(dObj);
            txtFechaHasta.value = dateAStr(hObj);
        };
    });


    // 6. SECCIÓN BBIS: COMPRESIÓN INTELIGENTE CONTINUA DE HORAS DESDE-HASTA
    document.querySelectorAll('.btn-horas-bloque').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            btn.classList.toggle('active');
            
            let activos = document.querySelectorAll('.btn-horas-bloque.active');
            if (activos.length === 0) {
                document.querySelectorAll('.btn-horas-bloque').forEach(b => b.classList.add('active'));
                activos = document.querySelectorAll('.btn-horas-bloque.active');
            }

            if (activos.length === 6) {
                txtHoraDesde.value = "00:00";
                txtHoraHasta.value = "24:00";
                return;
            }

            let bloquesFisicos = [];
            document.querySelectorAll('.btn-horas-bloque').forEach((b, i) => {
                if (b.classList.contains('active')) bloquesFisicos.push(i);
            });

            let intervalosCompresos = [];
            let i = 0;
            while (i < bloquesFisicos.length) {
                let start = bloquesFisicos[i];
                let end = start;
                while (i + 1 < bloquesFisicos.length && bloquesFisicos[i + 1] === end + 1) {
                    end = bloquesFisicos[++i];
                }
                const hrInicio = document.querySelectorAll('.btn-horas-bloque')[start].getAttribute('data-bloque').split('-')[0];
                const hrFin = document.querySelectorAll('.btn-horas-bloque')[end].getAttribute('data-bloque').split('-')[1];
                intervalosCompresos.push(`${hrInicio.padStart(2,'0')}:00//${hrFin.padStart(2,'0')}:00`);
                i++;
            }

            let tDesde = [], tHasta = [];
            intervalosCompresos.forEach(intervalo => {
                const [d, h] = intervalo.split('//');
                tDesde.push(d); tHasta.push(h);
            });

            txtHoraDesde.value = tDesde.join(',');
            txtHoraHasta.value = tHasta.join(',');
        };
    });

    // 7. REGLA D: VALIDACIÓN E INVERSIÓN
    function validarEInvertirFechasDra() {
        if (!txtFechaDesde.value || !txtFechaHasta.value) return;
        
        function deCadenaADate(s) {
            const p = s.split(s.includes('/') ? '/' : '-');
            return new Date(2000 + parseInt(p[2],10), parseInt(p[1],10)-1, parseInt(p[0],10));
        }

        let d = deCadenaADate(txtFechaDesde.value);
        let h = deCadenaADate(txtFechaHasta.value);
        
        if (d > h) {
            const t = txtFechaDesde.value; 
            txtFechaDesde.value = txtFechaHasta.value; 
            txtFechaHasta.value = t;
            ultimoInputModificado = (ultimoInputModificado === 'desde') ? 'hasta' : 'desde';
        }
    }

    // 8. ACCIÓN: BOTÓN INVERTIR
    if (btnInvertir) {
        btnInvertir.onclick = function(e) {
            e.stopPropagation();
            const tot = document.querySelectorAll('.btn-horas-bloque').length;
            const act = document.querySelectorAll('.btn-horas-bloque.active').length;
            if (act === tot) {
                if (typeof procesarBotonSecuencial === 'function') procesarBotonSecuencial();
                drawer.style.left = '-500px';
            } else {
                document.querySelectorAll('.btn-horas-bloque').forEach(b => b.classList.toggle('active'));
                const unBloque = document.querySelector('.btn-horas-bloque');
                if (unBloque) { unBloque.click(); unBloque.click(); }
            }
        };
    }

    // 9. ACCIÓN: BOTÓN LIMPIAR CONDICIÓN DEFAULT
    if (btnLimpiar) {
        btnLimpiar.onclick = function(e) {
            e.stopPropagation();
            if (typeof inicializarRangoDefaultDrawer === 'function') {
                inicializarRangoDefaultDrawer();
            }
            document.querySelectorAll('.btn-horas-bloque').forEach(b => b.classList.add('active'));
            document.querySelectorAll('.btn-tiempo-rapido').forEach(b => b.classList.remove('active'));
            
            // Forzamos a que el listado lateral se limpie y muestre todo de golpe
            if (typeof ejecutarFiltradoDatosUro === 'function') {
                ejecutarFiltradoDatosUro();
            }
        };
    }


    // 10. ACCIÓN: BOTÓN APLICAR FILTRO (CIERRE AUTOMÁTICO SOLICITADO)
    if (btnAplicar) {
        btnAplicar.onclick = function(e) {
            e.stopPropagation();            
            // Bloque de seguridad para contener errores internos de filtrado
            try {
                if (typeof ejecutarFiltradoDatosUro === 'function') {
                    ejecutarFiltradoDatosUro();
                }
            } catch (error) {
                // Si la función de filtros truena, el navegador atrapa el error aquí 
                // e impide que se congele el flujo del botón
                console.error("Error dentro de ejecutarFiltradoDatosUro:", error);
            }
            // Ahora el flujo SIEMPRE llegará aquí, obligando al panel a cerrarse
            drawer.style.left = '-500px';
        };
    }
}


// 11. DETECCION DE ESCRITURA MANUAL AL ENTER
function validarLimitesTeclado(input, esDesde) {
    if (!input || !input.value.trim()) return;
    const keys = Object.keys(datosGlobales);
    if (keys.length === 0) return;
    
    let fechasOrdenadas = [];
    keys.forEach(k => {
        if (datosGlobales[k] && datosGlobales[k].fecha) {
            const [f] = datosGlobales[k].fecha.split(' ');
            const sep = f.includes('/') ? '/' : '-';
            const [d, m, y] = f.split(sep);
            const aFull = (y.length === 4) ? parseInt(y, 10) : 2000 + parseInt(y, 10);
            const dObj = new Date(aFull, parseInt(m, 10) - 1, parseInt(d, 10));
            if (!isNaN(dObj.getTime())) fechasOrdenadas.push(dObj);
        }
    });

    if (fechasOrdenadas.length === 0) return;
    fechasOrdenadas.sort((a, b) => a - b);
    const dMin = fechasOrdenadas[0];
    const dMax = fechasOrdenadas[fechasOrdenadas.length - 1];
    
    const p = input.value.trim().split(input.value.includes('/') ? '/' : '-');
    if (p.length === 3) {
        const aEval = (p[2].length === 4) ? parseInt(p[2], 10) : 2000 + parseInt(p[2], 10);
        let dateEval = new Date(aEval, parseInt(p[1], 10) - 1, parseInt(p[0], 10));

        // Validación y ajuste al ras de los límites cronológicos reales
        if (isNaN(dateEval.getTime())) {
            dateEval = esDesde ? dMin : dMax;
        } else if (dateEval < dMin) {
            dateEval = dMin;
        } else if (dateEval > dMax) {
            dateEval = dMax;
        }
        
        input.value = `${String(dateEval.getDate()).padStart(2,'0')}/${String(dateEval.getMonth()+1).padStart(2,'0')}/${String(dateEval.getFullYear()).substring(2)}`;
    }
    ultimoInputModificado = esDesde ? 'desde' : 'hasta';
    if (typeof actualizarSignosBotonesTiempo === 'function') actualizarSignosBotonesTiempo();
    validarEInvertirFechasDra();
}

document.addEventListener("DOMContentLoaded", () => {
    const d = document.getElementById('txt-fecha-desde');
    const h = document.getElementById('txt-fecha-hasta');
    
    if (d) {
        d.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); validarLimitesTeclado(d, true); } };
        d.onblur = function() { validarLimitesTeclado(d, true); }; // Validación al perder foco
    }
    if (h) {
        h.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); validarLimitesTeclado(h, false); } };
        h.onblur = function() { validarLimitesTeclado(h, false); }; // Validación al perder foco
    }
});

/**
 * =========================================================================
 * MOTOR DE FILTRADO CORREGIDO Y ACOPLADO PARA EL ARRANQUE
 * =========================================================================
 */
function ejecutarFiltradoDatosUro() {
    const fDesdeStr = document.getElementById('txt-fecha-desde').value.trim();
    const fHastaStr = document.getElementById('txt-fecha-hasta').value.trim();
    const hDesdeStr = document.getElementById('txt-hora-desde').value.trim();
    const hHastaStr = document.getElementById('txt-hora-hasta').value.trim();

    if (typeof datosGlobales === 'undefined' || !datosGlobales) return;

    // Detectar el modo correcto leyendo el estado del botón en el DOM para evitar variables indefinidas
    const btnDilataciones = document.getElementById('btn-filtro-dilataciones');
    const esModoDilatacionesActivo = btnDilataciones ? btnDilataciones.classList.contains('active') : false;

    function parsearFechaAInt(str) {
        const p = str.split('/');
        return parseInt(`20${p[2]}${p[1]}${p[0]}`, 10);
    }

    function parsearHoraAInt(str) {
        return parseInt(str.replace(':', ''), 10);
    }

    const dLimite = fDesdeStr ? parsearFechaAInt(fDesdeStr) : 0;
    const hLimite = fHastaStr ? parsearFechaAInt(fHastaStr) : 99999999;

    let primerIdVisible = null;

    Object.keys(datosGlobales).forEach((idMiccion) => {
        const estudio = datosGlobales[idMiccion];
        if (!estudio || !estudio.fecha) return;

        const [fechaEstudio, horaEstudio] = estudio.fecha.split(' ');
        const sep = fechaEstudio.includes('/') ? '/' : '-';
        const [d, m, y] = fechaEstudio.split(sep);
        const yCorto = (y.length === 4) ? y.substring(2) : y;
        
        const fechaEvalNum = parseInt(`20${yCorto}${m}${d}`, 10);
        const horaEvalNum = parseInt(horaEstudio.substring(0, 5).replace(':', ''), 10);

        let cumpleFecha = (fechaEvalNum >= dLimite && fechaEvalNum <= hLimite);
        let cumpleHora = true;

        if (hDesdeStr && hHastaStr) {
            const hIniArreglo = hDesdeStr.split(',').map(h => parsearHoraAInt(h));
            const hFinArreglo = hHastaStr.split(',').map(h => parsearHoraAInt(h));
            
            let machHorario = false;
            for (let i = 0; i < hIniArreglo.length; i++) {
                const inicio = hIniArreglo[i];
                const fin = hFinArreglo[i];
                
                if (inicio > fin) {
                    if (horaEvalNum >= inicio || horaEvalNum <= fin) {
                        machHorario = true;
                        break;
                    }
                } else {
                    if (horaEvalNum >= inicio && horaEvalNum <= fin) {
                        machHorario = true;
                        break;
                    }
                }
            }
            cumpleHora = machHorario;
        }

        if (cumpleFecha && cumpleHora) {
            estudio.ocultoPorFiltro = false;
            if (primerIdVisible === null) {
                primerIdVisible = idMiccion;
            }
        } else {
            estudio.ocultoPorFiltro = true;
        }
    });

    if (primerIdVisible !== null) {
        // CORRECCIÓN DE CONTEXTO: Usamos la validación basada en el elemento del DOM
        if (esModoDilatacionesActivo) {
            seriesSeleccionadas = [];
        } else {
            seriesSeleccionadas = [primerIdVisible];
        }
        
        if (typeof renderizarListaMicciones === 'function') {
            renderizarListaMicciones();
        }
        
        const contenedor = document.getElementById('lista-micciones');
        if (contenedor) {
            const primerBotonVisible = contenedor.querySelector('.item-miccion');
            if (primerBotonVisible) {
                if (!esModoDilatacionesActivo) {
                    // Clic simple para activar el estado inicial del primer bloque
                    primerBotonVisible.click();
                }
                // CORREGIDO: Sintaxis estándar de JavaScript para disparar el evento doble clic de forma rígida
                if (typeof primerBotonVisible.ondblclick === 'function') {
                    primerBotonVisible.ondblclick();
                } else {
                    const eventoDoble = new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 });
                    primerBotonVisible.dispatchEvent(eventoDoble);
                }
            }
        }
        
    } else {
        seriesSeleccionadas = [];
        if (typeof renderizarListaMicciones === 'function') {
            renderizarListaMicciones();
        }
    }
}



document.addEventListener("DOMContentLoaded", () => {
    const d = document.getElementById('txt-fecha-desde'), h = document.getElementById('txt-fecha-hasta');
    if(d) d.onkeydown = function(e){ if(e.key==='Enter'){ e.preventDefault(); validarLimitesTeclado(d, true); } };
    if(h) h.onkeydown = function(e){ if(e.key==='Enter'){ e.preventDefault(); validarLimitesTeclado(h, false); } };
});

// ACTUALIZACIÓN VISUAL DE SIGNOS EN BOTONES DE TIEMPO RÁPIDO
function actualizarSignosBotonesTiempo() {
    document.querySelectorAll('.btn-tiempo-rapido').forEach(btn => {
        const dias = parseInt(btn.getAttribute('data-dias'), 10);
        
        // El botón Historial (365) es absoluto, no lleva signo
        if (dias === 365) return; 

        if (typeof ultimoInputModificado !== 'undefined' && ultimoInputModificado === 'desde') {
            if (dias === 0) {
                btn.textContent = 'Hoy';
            } else {
                btn.textContent = `+ ${dias} Días`;
            }
        } else {
            if (dias === 0) {
                btn.textContent = 'Hoy';
            } else {
                btn.textContent = `- ${dias} Días`;
            }
        }
    });
}

/**
 * =========================================================================
 * SUBRUTINA MAESTRA CENTRALIZADA: ALIMENTAR PANEL FLOTANTE EVENTOS (INMUNE)
 * =========================================================================
 */
function alimentarPanelFlotanteEventos(selectoresHijosClase, idMadreActual, origenAccion) {
    const flotante = document.getElementById('flotante-hijos-uro');
    const flotanteTitulo = document.getElementById('flotante-titulo');
    const flotanteContenido = document.getElementById('flotante-lista-contenido');
    const contenedorLista = document.getElementById('lista-micciones');
    
    if (!flotante || !flotanteContenido || !contenedorLista) return;

    // ==========================================================
    // 1. AUDITORÍA: AUTO-DESELECCIÓN DE MADRES VACÍAS
    // ==========================================================
    const todasLasMadresActivas = contenedorLista.querySelectorAll('.maestro-dia.active, .maestro-dilatacion.active');
    
    todasLasMadresActivas.forEach(madre => {
        const subLista = madre.nextElementSibling;
        if (!subLista || !subLista.classList.contains('sublista-acordeon-hijas')) return;
        
        // SOLUCIÓN REAL: Buscamos genéricamente por cualquier botón que tenga data-id, evitando que el bucle trone
        const hijosDeEstaMadre = subLista.querySelectorAll('button[data-id]');
        let conteoHijosActivosInSitu = 0;
        
        hijosDeEstaMadre.forEach(btnOriginal => {
            if (typeof datosGlobales !== 'undefined') {
                const idMiccionRígido = btnOriginal.getAttribute('data-id');
                if (idMiccionRígido && seriesSeleccionadas.includes(idMiccionRígido)) {
                    conteoHijosActivosInSitu++;
                }
            }
        });
        
        if (conteoHijosActivosInSitu === 0) {
            madre.classList.remove('active');
            madre.style.backgroundColor = '#7f8c8d'; 
            madre.style.color = '#ffffff';
            if (subLista) subLista.style.display = 'none'; 
            if (typeof reiniciarBotonSecuencial === 'function') reiniciarBotonSecuencial();
        }
    });

    // MEMORIA DE SCROLL PREVIA
    const posicionScrollPrevia = flotanteContenido.scrollTop;
    let idMiccionAnclaSuperior = null;
    let anclaDesplazamientoRelativo = 0;

    const clonesActuales = flotanteContenido.querySelectorAll('[data-id-miccion]');
    const rectContenedorPre = flotanteContenido.getBoundingClientRect();
    for (let clon of clonesActuales) {
        const rectClon = clon.getBoundingClientRect();
        if (rectClon.bottom >= rectContenedorPre.top) {
            idMiccionAnclaSuperior = clon.getAttribute('data-id-miccion');
            anclaDesplazamientoRelativo = rectClon.top - rectContenedorPre.top;
            break;
        }
    }

    if (!window._madresActivasCache) window._madresActivasCache = [];
    const idsMadresAnteriores = [...window._madresActivasCache];

    // LIMPIEZA Y RECONSTRUCCIÓN TRAS AUDITORÍA
    flotanteContenido.innerHTML = '';
    
    const madresActivas = contenedorLista.querySelectorAll('.maestro-dia.active, .maestro-dilatacion.active');
    const idsMadresActuales = Array.from(madresActivas).map(m => m.id || m.innerHTML);
    window._madresActivasCache = idsMadresActuales;
        
    if (madresActivas.length === 0 || !seriesSeleccionadas || seriesSeleccionadas.length === 0) {
        flotante.style.display = 'none';
        if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
        return;
    }

    if (flotanteTitulo) {
        flotanteTitulo.textContent = madresActivas.length === 1 ? `Estudios Seleccionados` : `Panel Multi-Ciclo Urodinámico`;
    }

    let nodoHijoRecienteTocado = null;
    let nodoHijoDestinoParaAnimar = null;

    // 2. ESCANEO CLÍNICO ESTRICTO: Solo barremos las sublistas de las madres activas
    madresActivas.forEach(madreAsociada => {
        const subLista = madreAsociada.nextElementSibling;
        if (!subLista || !subLista.classList.contains('sublista-acordeon-hijas')) return;

        // Barremos genéricamente todos los botones hijos que tengan el atributo data-id asignado
        subLista.querySelectorAll('button[data-id]').forEach((btnOriginal, indiceHijo) => {
            
            // MIGRACIÓN PROFESIONAL AL ID: Extraemos la llave maestra directamente de su piel
            let idMiccionReal = btnOriginal.getAttribute('data-id');

            // Generamos un identificador único para el DOM basado en datos o en su posición física exacta
            const idUnicoInfallible = idMiccionReal || `${madreAsociada.id || 'madre'}-hijo-${indiceHijo}`;

            // Fabricamos el clon interactivo
            const clonBtn = btnOriginal.cloneNode(true);
            clonBtn.style.width = '100%';
            clonBtn.style.marginBottom = '2px';
            clonBtn.style.transition = 'opacity 0.15s, filter 0.15s';
            
            // Seteamos las credenciales de identidad en el HTML del clon
            clonBtn.setAttribute('data-id-miccion', idUnicoInfallible);
            clonBtn.setAttribute('data-id-madre', madreAsociada.id || madreAsociada.innerHTML);

            // === LÓGICA DE ESTADO CLÍNICO REAL UNIFICADO ===
            // Evaluamos la verdad de los datos: si el ID no está explícitamente activo, 
            // el botón de control NACE apagado (Pastel / Negro) de forma obligatoria
            let estaApagado = true;
            if (idMiccionReal) {
                estaApagado = !seriesSeleccionadas.includes(idMiccionReal);
            }

            // === SINCRONIZACIÓN DE CLONES MIGRADA AL MOTOR MATEMÁTICO ===
            function sincronizarEstiloClon() {
                clonBtn.className = btnOriginal.className;
                
                // SOLUCIÓN CLÍNICA: En lugar de raspar data-id del DOM que puede estar vacío en el arranque,
                // consumimos de forma rígida la variable idMiccionReal calculada por el bucle padre.
                // Limpiamos las letras "AD_" o "MX_" para pasarle el número puro a la fórmula HSL
                const idLimpioParaFormula = typeof idMiccionReal === 'string' ? idMiccionReal.replace('AD_', '') : idMiccionReal;
                const cromaticaRealHijo = obtenerConfiguracionCromatica('HIJO', idLimpioParaFormula);

                if (estaApagado) {
                    // ESTADO INACTIVO PASTEL REGULADO (Fondo pastel / Texto Negro)
                    clonBtn.style.opacity = '1';
                    clonBtn.style.filter = 'none';
                    clonBtn.style.backgroundImage = 'none';
                    clonBtn.style.backgroundColor = cromaticaRealHijo.pastel;
                    clonBtn.style.color = '#000000'; // Fuerza letras negras legibles en el drawer
                } else {
                    // ESTADO ACTIVO SÓLIDO VIVO (Color sólido / Texto de contraste automático)
                    clonBtn.style.opacity = '1';
                    clonBtn.style.filter = 'none';
                    clonBtn.style.backgroundImage = 'none';
                    clonBtn.style.backgroundColor = cromaticaRealHijo.solido;
                    clonBtn.style.color = cromaticaRealHijo.txtSolido; 
                }
            }

            sincronizarEstiloClon();

            // Identificación para el escenario B1 (Scroll suave)
            if (origenAccion === 'sidebar' && idsMadresAnteriores.length < idsMadresActuales.length) {
                const madreReciente = idsMadresActuales.find(id => !idsMadresAnteriores.includes(id));
                if (madreReciente && (madreAsociada.id === madreReciente || madreAsociada.innerHTML === madreReciente) && !nodoHijoDestinoParaAnimar) {
                    nodoHijoDestinoParaAnimar = clonBtn;
                }
            }

            // === CONTROL DE EVENTOS CON ASIGNACIÓN DE IDENTIDAD DIRECTA ===
            clonBtn.onclick = function(eClick) {
                eClick.stopPropagation();
                
                // --- NIVEL 1: CLIC SIMPLE ---
                if (eClick.detail === 1) {
                    // Presionamos el botón original exacto usando la referencia directa en memoria
                    btnOriginal.click(); 
                    
                    if (typeof alimentarPanelFlotanteEventos === 'function') {
                        alimentarPanelFlotanteEventos(selectoresHijosClase, idMadreActual, 'panel-click');
                    }
                }
                
                // --- NIVEL 2: DOBLE CLIC ---
                if (eClick.detail === 2) {
                    eClick.preventDefault();
                    
                    subLista.querySelectorAll(selectoresHijosClase).forEach(hermanoOriginal => {
                        if (hermanoOriginal !== btnOriginal) {
                            const idHermanoReal = Object.keys(datosGlobales).find(k => {
                                const est = datosGlobales[k];
                                if (!est || !est.fecha) return false;
                                const partes = est.fecha.split(' ');
                                return partes && partes.length >= 2 && hermanoOriginal.innerHTML.includes(partes[1].substring(0, 5));
                            });
                            if (idHermanoReal) {
                                const indexHermano = seriesSeleccionadas.indexOf(idHermanoReal);
                                if (indexHermano !== -1) seriesSeleccionadas.splice(indexHermano, 1);
                            }
                        }
                    });
                    
                    if (idMiccionReal && !seriesSeleccionadas.includes(idMiccionReal)) {
                        seriesSeleccionadas.push(idMiccionReal);
                    }
                    
                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                    if (typeof alimentarPanelFlotanteEventos === 'function') {
                        alimentarPanelFlotanteEventos(selectoresHijosClase, idMadreActual, 'panel-doble-click');
                    }
                }
                
                // --- NIVEL 3: TRIPLE CLIC ---
                if (eClick.detail === 3) {
                    eClick.preventDefault();
                    
                    if (idMiccionReal) {
                        seriesSeleccionadas = [idMiccionReal];
                    }
                    
                    contenedorLista.querySelectorAll('.maestro-dia, .maestro-dilatacion').forEach(m => {
                        if (m !== madreAsociada) {
                            m.classList.remove('active');
                            m.style.backgroundColor = '#7f8c8d';
                            m.style.color = '#ffffff';
                            if (m.nextElementSibling) m.nextElementSibling.style.display = 'none';
                        }
                    });
                    
                    if (typeof renderizarGraficaEstandar === 'function') renderizarGraficaEstandar();
                    if (typeof alimentarPanelFlotanteEventos === 'function') {
                        alimentarPanelFlotanteEventos(selectoresHijosClase, idMadreActual, 'panel-triple-click');
                    }
                }
            };

            flotanteContenido.appendChild(clonBtn);
        });
    });



// 3. UBICACIÓN ADAPTATIVA DE PANTALLA (PC vs CV vs CH)
    const rectLista = contenedorLista.getBoundingClientRect();
    const esCelularHorizontal = window.innerWidth <= 840 && window.innerHeight <= 480;
    const esCelularVertical = window.innerWidth <= 480 && window.innerHeight > 480;

    // === PURGA COERCITIVA DE CACHÉ VISUAL DE ALTURAS ===
    flotante.style.transform = 'none';
    flotante.style.position = 'absolute';
    flotante.style.top = 'auto';
    flotante.style.bottom = 'auto';
    flotante.style.left = 'auto';
    flotanteContenido.style.maxHeight = '140px'; // Resetea al alto base de PC

    if (esCelularVertical) {
        flotante.style.position = 'fixed';
        flotante.style.bottom = '42%'; 
        flotante.style.top = 'auto';
        flotante.style.left = '50%';
        flotante.style.transform = 'translateX(-50%)';
        flotante.style.width = '85%';
        flotanteContenido.style.maxHeight = '90px'; 
    } else if (esCelularHorizontal) {
        flotante.style.position = 'fixed';
        flotante.style.top = '65px';
        flotante.style.left = '50%';
        flotante.style.transform = 'translateX(-50%)';
        flotante.style.width = '45%'; 
        flotanteContenido.style.maxHeight = '70px'; 
    } else {
        flotante.style.position = 'absolute';
        flotante.style.width = '220px';
        flotante.style.top = `${rectLista.top + window.scrollY}px`;
        flotante.style.left = `${rectLista.right + window.scrollX + 6}px`; 
        flotanteContenido.style.maxHeight = '140px';
    }
    
    if (flotanteContenido.children.length === 0) {
        flotante.style.display = 'none';
        return; 
    } else {
        flotante.style.display = 'block';
    }

    // ==========================================================
    // 4. ALGORITMO DE RECONCILIACIÓN DE SCROLL INTELIGENTE
    // ==========================================================
    if (flotante.style.display === 'block') {
        
        // CASO E: Triple clic (Resetea scroll al inicio)
        if (origenAccion === 'panel-triple-click') {
            flotanteContenido.scrollTop = 0;
            return;
        }

        // CASO D: Clic simple o doble (Preservación exacta del píxel previo)
        if (origenAccion === 'panel-click' || origenAccion === 'panel-doble-click') {
            flotanteContenido.scrollTop = posicionScrollPrevia;
            return;
        }

        // INTERACCIONES DESDE EL SIDEBAR IZQUIERDO
        if (origenAccion === 'sidebar') {
            const seAgregoMadre = idsMadresAnteriores.length < idsMadresActuales.length;
            const seQuitoMadre = idsMadresAnteriores.length > idsMadresActuales.length;

            // CASO B1: Se agregó una madre (Desplazamiento animado suave al elemento nuevo)
            if (seAgregoMadre && nodoHijoDestinoParaAnimar) {
                setTimeout(() => {
                    const rectHijo = nodoHijoDestinoParaAnimar.getBoundingClientRect();
                    const rectContenedor = flotanteContenido.getBoundingClientRect();
                    const distanciaRealTop = rectHijo.top - rectContenedor.top + flotanteContenido.scrollTop;
                    const scrollDestino = distanciaRealTop - (flotanteContenido.clientHeight / 2) + (nodoHijoDestinoParaAnimar.clientHeight / 2);
                    flotanteContenido.scrollTo({ top: scrollDestino, behavior: 'smooth' });
                }, 50);
                return;
            }

            // CASO A: Se eliminó una madre
            if (seQuitoMadre) {
                const anclaNueva = idMiccionAnclaSuperior ? flotanteContenido.querySelector(`[data-id-miccion="${idMiccionAnclaSuperior}"]`) : null;
                
                if (anclaNueva) {
                    // CASO A2: La madre quitada estaba abajo, el ancla superior sigue viva. Alineación milimétrica.
                    const rectAncla = anclaNueva.getBoundingClientRect();
                    flotanteContenido.scrollTop = rectAncla.top - flotanteContenido.getBoundingClientRect().top + flotanteContenido.scrollTop - anclaDesplazamientoRelativo;
                } else if (idsMadresActuales.length > 0) {
                    // CASO A1: Se borró la madre que el usuario leía. Centramos el último hijo de la madre superior.
                    const hijosSustitutos = flotanteContenido.querySelectorAll(`[data-id-madre="${idsMadresActuales[idsMadresActuales.length - 1]}"]`);
                    if (hijosSustitutos.length > 0) {
                        const nodoSustituto = hijosSustitutos[hijosSustitutos.length - 1];
                        setTimeout(() => {
                            const distanciaRealTop = nodoSustituto.getBoundingClientRect().top - flotanteContenido.getBoundingClientRect().top + flotanteContenido.scrollTop;
                            flotanteContenido.scrollTop = distanciaRealTop - (flotanteContenido.clientHeight / 2) + (nodoSustituto.clientHeight / 2);
                        }, 50);
                    }
                }
                return;
            }
        }
        
        // Resguardo general para cualquier otro tipo de refresco o carga inicial
        flotanteContenido.scrollTop = posicionScrollPrevia;
    }
}

/**
 * =========================================================================
 * EMULADOR DE CLICS MÚLTIPLES POR SOFTWARE PARA PANTALLAS TÁCTILES (CEL)
 * =========================================================================
 */
document.addEventListener("DOMContentLoaded", () => {
    const contenedorLista = document.getElementById('lista-micciones');
    if (!contenedorLista) return;

    // Variables de persistencia cronológica para el sensor táctil
    let ultimoToqueTiempo = 0;
    let contadorToques = 0;
    let temporizadorToques = null;

    // Escuchamos los toques físicos del dedo en toda la zona del listado izquierdo
    contenedorLista.addEventListener('touchstart', function(e) {
        // Localizamos si el toque ocurrió exactamente en una etiqueta madre (MX o AD)
        const botonMaestro = e.target.closest('.maestro-dia, .maestro-dilatacion');
        if (!botonMaestro) return;

        // Deshabilitamos el zoom y el comportamiento elástico nativo del celular
        e.preventDefault();
        e.stopPropagation();

        const tiempoActual = new Date().getTime();
        const diferenciaMilisegundos = tiempoActual - ultimoToqueTiempo;
        ultimoToqueTiempo = tiempoActual;

        // Si la pulsación ocurre en un intervalo menor a 300ms, incrementamos el contador
         // === CALIBRACIÓN TÁCTIL RELAJADA (Intervalo de 400ms solicitado) ===
        if (diferenciaMilisegundos < 400) {
            contadorToques++;
        } else {
            contadorToques = 1; 
        }

        if (temporizadorToques) clearTimeout(temporizadorToques);

        // === ESPERA ELÁSTICA NATURAL (Colchón de 300ms solicitado) ===
        temporizadorToques = setTimeout(() => {
            const eventoSimulado = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: contadorToques 
            });

            botonMaestro.dispatchEvent(eventoSimulado);
            contadorToques = 0;
        }, 300);

    }, { passive: false }); // Desactivamos el passive de forma coercitiva para permitir el preventDefault
});
