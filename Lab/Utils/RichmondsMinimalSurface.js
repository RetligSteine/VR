//RICHMOND'S MINIMAL SURFACE
//Генерування OBJ-тексту для Мінімальної Поверхні Річмонда
function generateRichmondSurfaceOBJ() {
    let vertices = [];
    let faces = [];
    let uMin = 0.25, uMax = 1.25, vMin = 0, vMax = 2 * Math.PI;
    let uSteps = 25, vSteps = 150;
    let uStep = (uMax - uMin) / uSteps;
    let vStep = (vMax - vMin) / vSteps;

    //Створюємо вершини для поверхні Річмонда
    for (let i = 0; i <= uSteps; i++) {
        let u = uMin + i * uStep;
        for (let j = 0; j <= vSteps; j++) {
            let v = vMin + j * vStep;
            let x = -Math.cos(v) / (2 * u) - (u * u * u * Math.cos(3 * v)) / 6;
            let y = -Math.sin(v) / (2 * u) - (u * u * u * Math.sin(3 * v)) / 6;
            let z = u * Math.cos(v);
            vertices.push([x, y, z]);
        }
    }

    //Створюємо трикутники
    for (let i = 0; i < uSteps; i++) {
        for (let j = 0; j < vSteps; j++) {
            let v0ind = i * (vSteps + 1) + j;
            let v1ind = v0ind + 1;
            let v2ind = v0ind + (vSteps + 1);
            let v3ind = v2ind + 1;

            //OBJ індекси починаються з 1, тому додаємо +1
            faces.push([v0ind + 1, v2ind + 1, v1ind + 1]);
            faces.push([v1ind + 1, v2ind + 1, v3ind + 1]);
        }
    }

    //OBJ-текст
    let objContent = '# Richmond Minimal Surface\n';
    vertices.forEach(v => {
        objContent += `v ${v[0]} ${v[1]} ${v[2]}\n`;
    });
    faces.forEach(f => {
        objContent += `f ${f[0]} ${f[1]} ${f[2]}\n`;
    });

    return objContent;
}


//Функція для завантаження OBJ у сцену
function loadRichmondSurface() {
    const objContent = generateRichmondSurfaceOBJ();

    //Blob і URL для OBJ
    const objBlob = new Blob([objContent], { type: 'text/plain' });
    const objURL = URL.createObjectURL(objBlob);

    //Завантажуємо
    const loader = new THREE.OBJLoader();
    loader.load(objURL, (object) => {
        const material = new THREE.MeshNormalMaterial({
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });

        object.traverse(child => {
            if (child.isMesh) {
                child.material = material;
            }
        });

        object.position.y = 2;
        object.scale.set(0.25, 0.25, 0.25);
        arWorldRoot.add(object);
        onRenderFcts.push(function () {
            object.rotation.x += 0.01;
            object.rotation.y += 0.01;
            object.rotation.z += 0.01;
        });
        URL.revokeObjectURL(objURL);
    }, undefined, (error) => {
        console.error('Error loading OBJ:', error);
    });
}