//RICHMOND'S MINIMAL SURFACE
//Basing on the skeleton project add a new js script file containing Model object.
//Model object has to draw the surface wireframe as two sets of vertices: a set of U polylines and a set of V polylines.
function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function Vertex(p) {
    this.p = p;
    this.normal = [];
    this.triangles = [];
}

function Triangle(v0, v1, v2) {
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.normal = [];
    this.tangent = [];
}

//Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STREAM_DRAW);

        this.count = indices.length;
    }

    this.Draw = function() {
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }

    this.DrawWireframe = function() {
        for (let p = 0; p < this.count; p += 3)
            gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, p * 2); // Множимо на 2, бо індекси в байтах
    }
}


//Створення точок Мінімальної поверхні Річмонда
function CreateSurfaceData() {
    let vertices = [];
    let triangles = [];
    let uMin = 0.25, uMax = 1, vMin = 0, vMax = 2 * Math.PI;
    let uSteps = 30, vSteps = 30; // Кількість кроків для U та V
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
            vertices.push(new Vertex([x, y, z]));
        }
    }

    // Створюємо трикутники
    for (let i = 0; i < uSteps; i++) {
        for (let j = 0; j < vSteps; j++) {
            let v0ind = i * (vSteps + 1) + j;        // поточна вершина
            let v1ind = v0ind + 1;                   // наступна по V
            let v2ind = v0ind + (vSteps + 1);        // наступна по U
            let v3ind = v2ind + 1;                   // наступна по U і V

            //Перший трикутник
            let trian1 = new Triangle(v0ind, v2ind, v1ind);
            let trianInd1 = triangles.length;
            triangles.push(trian1);
            vertices[v0ind].triangles.push(trianInd1);
            vertices[v2ind].triangles.push(trianInd1);
            vertices[v1ind].triangles.push(trianInd1);

            //Другий трикутник
            let trian2 = new Triangle(v1ind, v2ind, v3ind);
            let trianInd2 = triangles.length;
            triangles.push(trian2);
            vertices[v1ind].triangles.push(trianInd2);
            vertices[v2ind].triangles.push(trianInd2);
            vertices[v3ind].triangles.push(trianInd2);
        }
    }

    //Перетворюємо вершини у Float32Array
    let data = {};
    data.verticesF32 = new Float32Array(vertices.length * 3);
    for (let i = 0, len = vertices.length; i < len; i++) {
        data.verticesF32[i * 3 + 0] = vertices[i].p[0];
        data.verticesF32[i * 3 + 1] = vertices[i].p[1];
        data.verticesF32[i * 3 + 2] = vertices[i].p[2];
    }

    //Перетворюємо індекси трикутників у Uint16Array
    data.indicesU16 = new Uint16Array(triangles.length * 3);
    for (let i = 0, len = triangles.length; i < len; i++) {
        data.indicesU16[i * 3 + 0] = triangles[i].v0;
        data.indicesU16[i * 3 + 1] = triangles[i].v1;
        data.indicesU16[i * 3 + 2] = triangles[i].v2;
    }

    return data;
}