import Person from 'person.js';
import { formatSalary } from './util.js';

export default class Worker extends Person {
  constructor(props) {
    super(props);
    this.occupation = props.occupation;
    this.salary = formatSalary(props.salary);
  }

  getWorker() {
    let personInfo = this.getPerson();
    return Object.assign({}, personInfo, {
      occupation: this.occupation,
      salary: this.salary
    })
  }
}