//RICHMOND'S MINIMAL SURFACE
//Basing on the skeleton project add a new js script file containing Model object.
//Model object has to draw the surface wireframe as two sets of vertices: a set of U polylines and a set of V polylines.
//Shading Gouraud

//Кут з градусів в радіани
function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// p: an array of xyz vertex coords
// t: an array of uv tex coords
function Vertex(p, t) {
    this.p = p;
    this.t = t;
    this.normal = [0, 0, 0];
    this.triangles = [];
}

function Triangle(v0, v1, v2) {
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.normal = [];
    this.tangent = [];
}

//Модель поверхні Річмонда
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTexCoordsBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    //Текстури мої текстурочки
    this.idTextureDiffuse = -1;
    this.idTextureSpecular = -1;
    this.idTextureNormal = -1;
    
    //Забуферизувати дані
    this.BufferData = function (vertices, normals, texCoords, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
    
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    
        gl.vertexAttribPointer(shProgram.iAttribTexCoords, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoords);
    
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    
        this.idTextureDiffuse = diffuseTexture;
        this.idTextureSpecular = specularTexture;
        this.count = indices.length;
    }

    //Відтворити дані
    this.Draw = function () {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);
        gl.uniform1i(gl.getUniformLocation(shProgram.prog, "diffuseTexture"), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureSpecular);
        gl.uniform1i(gl.getUniformLocation(shProgram.prog, "specularTexture"), 1);

        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
}



function CreateSurfaceData(data) {
    let vertices = [];
    let triangles = [];

    //Межі поверхні
    let uMin = 0.25, uMax = 1.3, vMin = 0, vMax = 2 * Math.PI;

    //Крок для u та v
    let uStep = (uMax - uMin) / uGranularity;
    let vStep = (vMax - vMin) / vGranularity;

    //Обчислення вершин поверхні
    //З попередньої лаби
    for (let i = 0; i <= uGranularity; i++) {
        let u = uMin + i * uStep;
        for (let j = 0; j <= vGranularity; j++) {
            let v = vMin + j * vStep;

            //Функція поверхні
            let x = -Math.cos(v) / (2 * u) - (u * u * u * Math.cos(3 * v)) / 6;
            let y = -Math.sin(v) / (2 * u) - (u * u * u * Math.sin(3 * v)) / 6;
            let z = u * Math.cos(v);

            //Нормалізовані текстурні координати
            //Додаємо масштабування
            //Масштабування текстурних координат без руху текстури
            let texU = ((u - uMin) / (uMax - uMin) - uOffset);
            let texV = ((v - vMin) / (vMax - vMin) - vOffset);

            //Застосування масштабування відносно точки без її зміщення
            texU = uOffset + (texU * textureScale);
            texV = vOffset + (texV * textureScale);

            //Нормалізація текстурних координат до діапазону [0, 1]
            texU = (texU % 1 + 1) % 1;
            texV = (texV % 1 + 1) % 1;

            vertices.push(new Vertex([x, y, z], [texU, texV]));
        }
    }

    //Розрахунок трикутників
    for (let i = 0; i < uGranularity; i++) {
        for (let j = 0; j < vGranularity; j++) {
            //Індекси 4 вершин кожного прямокутника
            let v0 = i * (vGranularity + 1) + j;
            let v1 = v0 + 1;
            let v2 = v0 + (vGranularity + 1);
            let v3 = v2 + 1;

            //А кожен чотирикутник утворює 2 трикутника
            triangles.push(new Triangle(v0, v2, v1));
            triangles.push(new Triangle(v1, v2, v3));

            //Прикріплюємо трикутники до вершин
            let trianInd = triangles.length - 2;
            vertices[v0].triangles.push(trianInd);
            vertices[v2].triangles.push(trianInd);
            vertices[v1].triangles.push(trianInd);

            let trianInd2 = triangles.length - 1;
            vertices[v1].triangles.push(trianInd2);
            vertices[v2].triangles.push(trianInd2);
            vertices[v3].triangles.push(trianInd2);
        }
    }

    //Розрахунок нормалей
    for (let triangle of triangles) {
        let v0 = vertices[triangle.v0].p;
        let v1 = vertices[triangle.v1].p;
        let v2 = vertices[triangle.v2].p;

        //Дві дотичні до поверхні
        let edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
        let edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

        //Беремо векторний добуток двох дотичних до поверхні(трикутника)
        triangle.normal = m4.cross(edge1, edge2);
        //І нормалізуємо результат
        m4.normalize(triangle.normal, triangle.normal);
    }

    //Додаємо всі нормалі до вершини
    for (let vertex of vertices) {
        let normal = [0, 0, 0];
        for (let triIndex of vertex.triangles) {
            let triNormal = triangles[triIndex].normal;
            normal[0] += triNormal[0];
            normal[1] += triNormal[1];
            normal[2] += triNormal[2];
        }
        //Нормалізуємо
        m4.normalize(normal, normal);
        vertex.normal = normal;
    }

    data.verticesF32 = new Float32Array(vertices.length * 3);
    data.normalsF32 = new Float32Array(vertices.length * 3);
    data.texCoordsF32 = new Float32Array(vertices.length * 2);

    for (let i = 0, len = vertices.length; i < len; i++) {
        data.verticesF32[i * 3 + 0] = vertices[i].p[0];
        data.verticesF32[i * 3 + 1] = vertices[i].p[1];
        data.verticesF32[i * 3 + 2] = vertices[i].p[2];

        data.normalsF32[i * 3 + 0] = vertices[i].normal[0];
        data.normalsF32[i * 3 + 1] = vertices[i].normal[1];
        data.normalsF32[i * 3 + 2] = vertices[i].normal[2];

        data.texCoordsF32[i * 2 + 0] = vertices[i].t[0];
        data.texCoordsF32[i * 2 + 1] = vertices[i].t[1];
    }

    data.indicesU16 = new Uint16Array(triangles.length * 3);
    for (let i = 0, len = triangles.length; i < len; i++) {
        data.indicesU16[i * 3 + 0] = triangles[i].v0;
        data.indicesU16[i * 3 + 1] = triangles[i].v1;
        data.indicesU16[i * 3 + 2] = triangles[i].v2;
    }
}


