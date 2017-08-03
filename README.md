# cabbage

## Models

### `Server`

#### Schema

* `String` name
* `String` address
* `String` username
* `String` password
* `Number` id

#### Endpoints

* `POST` /server/create
* `GET` /server/delete
* `POST` /server/edit
* `GET` /server/find
* `GET` /server/list

### `Project`

#### Schema

* `String` name
* `String` repo
* `Array[Number]` servers
* `Number` id

#### Endpoints

* `POST` /project/create
* `GET` /project/delete
* `POST` /project/edit
* `GET` /project/find
* `GET` /project/list
