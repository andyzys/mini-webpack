export default class Person {
  constructor(props) {
    this.name = props.name;
    this.age = props.age;
  }

  getPerson() {
    return {
      name: this.name,
      age: this.age
    }
  }
}