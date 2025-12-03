// Database entities will be defined here
// We'll use SeaORM's entity macros to define our tables

pub mod task;
pub mod task_project;

pub use task::Entity as Task;
pub use task_project::Entity as TaskProject;
