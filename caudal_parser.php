<?php
header('Content-Type: application/json; charset=utf-8');
$filename = __DIR__ . '/CAUDAL.txt';
if (!file_exists($filename)) {
    echo json_encode(['error' => 'El archivo CAUDAL.txt no se encuentra en la raiz del servidor.']);
    exit;
}
$lineas = file($filename, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$respuesta = [];
$fecha_anterior_rastreo = "";
$id_dia_contador = -1; 
$conteo_micciones_del_dia = 0;
$id_ContadorTotal =0;
$ciclo_dilatacion_actual = -1; 
$conteo_micciones_dilatacion = 0;
$sonda_fr_anterior = 0;
$mapa_ciclos_dilatacion = [];
$mapa_calibres_sonda = [];
$num_miccion = 0;
$contador_ciclos = 0;
$calibre_actual = 0;
$es_apertura_ciclo = [];
foreach ($lineas as $idx => $linea_original) {
    $datos_linea = explode(',', trim($linea_original));
    if (count($datos_linea) < 4) continue;
    $fecha_check = trim($datos_linea[0]);
    $apertura_detectada = 0;
    if (substr($fecha_check, 0, 1) === '@') {
        $partes_arroba = explode('@', $fecha_check);
        if (count($partes_arroba) >= 3) {
            $contador_ciclos++;
            $calibre_actual = intval($partes_arroba[1]);
            $apertura_detectada = 1;
        }
    }
    $mapa_ciclos_dilatacion[$idx] = $contador_ciclos;
    $mapa_calibres_sonda[$idx] = $calibre_actual;
    $es_apertura_ciclo[$idx] = $apertura_detectada;
}
$lineas_reversas = array_reverse($lineas, true);
foreach ($lineas_reversas as $idx_linea => $linea) {
    $datos = explode(',', trim($linea));
    if (count($datos) < 4) continue;
    $fecha_completa = trim($datos[0]);
    $sonda_fr_detectado = 0;
    $es_miccion_apertura = 0;
    if (substr($fecha_completa, 0, 1) === '@') {
        $partes_arroba = explode('@', $fecha_completa);
        if (count($partes_arroba) >= 3) {
            $fecha_completa = trim($partes_arroba[2]); // Aísla la fecha limpia "dd-mm-yyyy hh:mm:ss"
        }
    }
    $ciclo_asignado = isset($mapa_ciclos_dilatacion[$idx_linea]) ? $mapa_ciclos_dilatacion[$idx_linea] : 0;
    $sonda_fr_detectado = isset($mapa_calibres_sonda[$idx_linea]) ? $mapa_calibres_sonda[$idx_linea] : 0;
    $es_miccion_apertura = isset($es_apertura_ciclo[$idx_linea]) ? $es_apertura_ciclo[$idx_linea] : 0;
   $fecha_estandarizada = str_replace('-', '/', $fecha_completa);
    $fecha_partes_espacio = explode(" ", $fecha_estandarizada);
    $fecha_pura_10 = $fecha_partes_espacio[0];
    $hora_corta_5 = isset($fecha_partes_espacio[1]) ? substr($fecha_partes_espacio[1], 0, 5) : "00:00";
    $fecha_mix_final = $fecha_pura_10 . " " . $hora_corta_5;
    // B) Lógica Float idDia (Día.Micción consecutivo de Comadres)
    if ($fecha_pura_10 !== $fecha_anterior_rastreo) {
        $id_dia_contador++; 
        $conteo_micciones_del_dia = 0;
        $fecha_anterior_rastreo = $fecha_pura_10;
    } else {
        $conteo_micciones_del_dia++;
    }
    $id_dia_float = floatval($id_dia_contador + ($conteo_micciones_del_dia / 100));
    if ($sonda_fr_detectado !== $sonda_fr_anterior) {
        $ciclo_dilatacion_actual++;
        $conteo_micciones_dilatacion = 0;
        $sonda_fr_anterior = $sonda_fr_detectado;
    } else {
        $conteo_micciones_dilatacion++;
    }
    $id_dilatacion_float = floatval($ciclo_dilatacion_actual + ($conteo_micciones_dilatacion / 1000));
    $id_miccion = (strlen($fecha_completa) >= 16) ? substr($fecha_completa, 0, 5) . ' ' . substr($fecha_completa, 11, 5) : $fecha_completa;
    $unidad_tiempo_ms = floatval(trim($datos[1]));
    $lecturas_efectivas = intval(trim($datos[2]));
    $secuencia_cruda = implode(',', array_slice($datos, 3));
    $incrementos_crudos = array_slice($datos, 3);
    $incrementos_totales = [];
    foreach ($incrementos_crudos as $inc_crud) {
        $val = floatval(trim($inc_crud))/1000;
        $incrementos_totales[] = ($val < 0) ? 0.0 : $val;
    }
    $tiempo_seg = [];
    $volumen_acumulado = [];
    $flujo_mls = [];
    $vol_acumulado_temp = 0;
    $dt_seg = $unidad_tiempo_ms / 1000.0;
    foreach ($incrementos_totales as $index => $inc_vol) {
        $t_actual = $index * $dt_seg;
        $vol_acumulado_temp += $inc_vol;
        $flujo_inst = ($dt_seg > 0) ? ($inc_vol / $dt_seg) : 0;
        $tiempo_seg[] = round($t_actual, 3);
        $volumen_acumulado[] = round($vol_acumulado_temp, 3);
    	$flujo_mls[] = intval($flujo_inst * 1000) ;
    }
    if (empty($tiempo_seg)) continue;
    $incrementos_calculo = array_slice($incrementos_totales, 0, $lecturas_efectivas);
    $tiempo_seg_calc = [];
    $volumen_acumulado_calc = [];
    $flujo_mls_calc = [];
    $vol_calc_temp = 0;
    foreach ($incrementos_calculo as $index => $inc_vol) {
        $t_actual = $index * $dt_seg;
        $vol_calc_temp += $inc_vol;
        $flujo_inst = ($dt_seg > 0) ? ($inc_vol / $dt_seg) : 0;
        $tiempo_seg_calc[] = $t_actual;
        $volumen_acumulado_calc[] = $vol_calc_temp;
        $flujo_mls_calc[] = $flujo_inst;
    }
    $Vflow = end($volumen_acumulado_calc); // Volumen efectivo dentro de la ventana efectiva
    $Qmax = count($flujo_mls_calc) > 0 ? max($flujo_mls_calc) : 0;
    $Vflow = 0;
    foreach ($incrementos_calculo as $idx => $inc) {
        if (isset($flujo_mls_calc[$idx]) && $flujo_mls_calc[$idx] >= 0.1) $Vflow += $inc;
    }
    $Vdrop = 0;
    foreach ($incrementos_goteo as $inc_g) {
        if ($inc_g > 0) $Vdrop += $inc_g;
    $Vvoid = $Vflow + $Vdrop;
// SE HAN ELIMINADO VARIOS CÁLCULOS PARA REDUCIR EL TAMAÑO DEL ARCHIVO
    $siroky = ($Qmax - $flujo_medio_esperado) / 3.25;
    $calculos = [
        'Vvoid' => [
            'nomenclatura' => 'V<sub>void</sub>', 'nombre' => 'Volumen de Micción Total', 'valor' => number_format($Vvoid, 3), 'unidad' => 'mL', 'semaforo' => $sem_Vvoid, 'grupo' => 'volumenes',
            'explicacion' => 'Cantidad volumétrica total de orina evacuada recolectada dentro de la ventana de lecturas efectivas del uroflujómetro. Variable fundamental de control urodinámico; estudios con volúmenes inferiores a 150 mL carecen de representatividad estadística para el diagnóstico de obstrucción.',
            'explicacion_paciente' => 'Es la cantidad total de orina que expulsó en el contenedor durante toda la prueba. Es una medida clave, ya que si orina muy poquito, los resultados de fuerza no son estadísticamente confiables.',
            'rangos_normales' => 'Normal Adulto: Entre 150 y 500 mL (Verde).<br>Insuficiente para diagnóstico: Menor a 100 mL (Rojo).'
        ],
// SE HAN ELIMINADO VARIOS CÁLCULOS PARA REDUCIR EL TAMAÑO DEL ARCHIVO
        'Siroky' => [
            'nomenclatura' => 'Siroky<sub>score</sub>', 'nombre' => 'Nomograma de Siroky', 'valor' => number_format($siroky, 3), 'unidad' => '', 'semaforo' => $sem_siroky, 'grupo' => 'fluidos',
            'explicacion' => 'Puntuación predictiva basada en el Nomograma Clínico de Siroky y Liverpool. Modela matemáticamente el Flujo Máximo esperado en función de la raíz cuadrada del volumen funcional desalojado. Desviaciones por debajo de 0.75 confirman de forma robusta una restricción de flujo patológica obstructiva independiente del volumen.',
            'explicacion_paciente' => 'Es una herramienta internacional que compara matemáticamente la fuerza máxima de su chorro contra lo que se esperaría de un paciente sano que orinó exactamente su misma cantidad de líquido. Descarta falsos diagnósticos cuando orina poco.',
            'rangos_normales' => 'Flujo Normal Ideal: Mayor a 1.0 (Verde).<br>Patrón Obstructivo Clínico: Menor a 0.75 (Rojo).'
        ]
    ];
    $respuesta[] = [
        'idMix'         => $id_ContadorTotal,
        'idDia'         => $id_dia_float,
        'idDilatacion'  => $id_dilatacion_float,
        'frSonda'       => intval($sonda_fr_detectado),
        'fecha'         => $fecha_mix_final,
        'tiempo_seg'    => $dt_seg * 1000,
        'flujo_mls'     => $flujo_mls,
        'volTotal'    	=> $volumen_total_calculado,
        'calculos'      => $calculos
    ];
	$id_ContadorTotal++;}
header('Content-Type: application/json');
echo json_encode($respuesta);
?>
